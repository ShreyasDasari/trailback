/**
 * apps/extension/background/service-worker.js
 *
 * Trailback — MV3 Service Worker
 * Responsibilities:
 *   - Receive events from content scripts via chrome.runtime.sendMessage
 *   - Persist every event to chrome.storage.local immediately (queue-first)
 *   - Flush the queue to the backend API on a 30-second alarm interval
 *   - Poll Gmail Sent folder every 60s to catch server-side agent sends
 *   - Attempt an immediate flush on each new event (best-effort)
 */

import { getQueue, saveQueue, clearEvent } from '../utils/queue.js';

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const API_BASE          = 'https://trailback-gby8.onrender.com';
const EVENTS_ENDPOINT   = `${API_BASE}/api/v1/events`;
const ALARM_FLUSH       = 'trailback-flush';
const ALARM_POLL        = 'trailback-gmail-poll';
const FLUSH_INTERVAL    = 0.5;   // 30 seconds
const POLL_INTERVAL     = 1;     // 60 seconds
const POLL_LOOKBACK_MS  = 120000; // look back 2 minutes

// TODO: Replace with real token from chrome.identity / Supabase Auth
const DUMMY_TOKEN = 'dummy-bearer-token-replace-me';

// ─────────────────────────────────────────────────────────────
// Auth helper — gets a real Google OAuth token from the browser
// Falls back to DUMMY_TOKEN if identity API is unavailable
// ─────────────────────────────────────────────────────────────

async function getAuthToken() {
  try {
    return await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError || !token) {
          reject(chrome.runtime.lastError?.message || 'No token');
        } else {
          resolve(token);
        }
      });
    });
  } catch {
    // Not signed in yet — return dummy token for local dev
    return DUMMY_TOKEN;
  }
}

// ─────────────────────────────────────────────────────────────
// Installation — set up recurring alarms once
// ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_FLUSH, { periodInMinutes: FLUSH_INTERVAL });
  chrome.alarms.create(ALARM_POLL,  { periodInMinutes: POLL_INTERVAL });
  console.log('[Trailback] Extension installed. Alarms created.');
});

// Safety net: recreate alarms if service worker restarts
chrome.alarms.get(ALARM_FLUSH, (alarm) => {
  if (!alarm) chrome.alarms.create(ALARM_FLUSH, { periodInMinutes: FLUSH_INTERVAL });
});
chrome.alarms.get(ALARM_POLL, (alarm) => {
  if (!alarm) chrome.alarms.create(ALARM_POLL, { periodInMinutes: POLL_INTERVAL });
});

// ─────────────────────────────────────────────────────────────
// queueAndSync(payload)
//
// Entry point for all captured events.
//   1. Stamps with UUID + timestamp
//   2. Appends to chrome.storage.local immediately
//   3. Attempts a non-blocking flush right away
// ─────────────────────────────────────────────────────────────

export async function queueAndSync(payload) {
  const stamped = {
    ...payload,
    id:        crypto.randomUUID(),
    queued_at: Date.now(),
    synced:    false,
  };

  try {
    const queue = await getQueue();
    queue.push(stamped);
    await saveQueue(queue);
    console.log('[Trailback] Event queued:', stamped.id, stamped.metadata?.subject || stamped.action_type);
  } catch (err) {
    console.error('[Trailback] Failed to queue event:', err);
    return;
  }

  flushQueue().catch((err) =>
    console.warn('[Trailback] Immediate flush failed (will retry):', err)
  );
}

// ─────────────────────────────────────────────────────────────
// flushQueue()
//
// Reads pending events from storage and POSTs each to backend.
// Successful events are removed. Failed ones stay for retry.
// ─────────────────────────────────────────────────────────────

export async function flushQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return;

  console.log(`[Trailback] Flushing ${queue.length} event(s)...`);

  for (const event of queue) {
    try {
      const response = await fetch(EVENTS_ENDPOINT, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${DUMMY_TOKEN}`,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.warn(`[Trailback] Backend rejected event ${event.id}: ${response.status}`);
        continue;
      }

      await clearEvent(event.id);
      console.log('[Trailback] Event synced and cleared:', event.id);

    } catch (err) {
      console.warn(`[Trailback] Network error for event ${event.id}:`, err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// pollGmailSentFolder()
//
// Polls Gmail Sent folder every 60 seconds for new emails.
// This catches emails sent by ANY agent — browser, server-side,
// mobile, Slashy, Claude, custom scripts — anything.
//
// Deduplication: uses chrome.storage to track seen message IDs.
// ─────────────────────────────────────────────────────────────

async function pollGmailSentFolder() {
  try {
    const token = await getAuthToken();

    // Only poll with a real token — skip dummy token
    if (!token || token === DUMMY_TOKEN) {
      console.log('[Trailback] No real auth token yet — skipping Gmail poll');
      return;
    }

    // Look back 2 minutes to catch recently sent emails
    const afterTimestamp = Math.floor((Date.now() - POLL_LOOKBACK_MS) / 1000);

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:sent after:${afterTimestamp}&maxResults=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok) {
      console.warn('[Trailback] Gmail list API error:', listRes.status);
      return;
    }

    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) return;

    console.log(`[Trailback] Gmail poll: found ${listData.messages.length} recent sent email(s)`);

    for (const msg of listData.messages) {
      // ── Deduplication check ──────────────────────────────
      const seenKey = `trailback_seen_${msg.id}`;
      const alreadySeen = await chrome.storage.local.get(seenKey);
      if (alreadySeen[seenKey]) continue;

      // Mark as seen immediately to prevent double-logging
      await chrome.storage.local.set({ [seenKey]: true });

      // ── Fetch full message details ───────────────────────
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      // ── Extract headers ──────────────────────────────────
      const headers   = msgData.payload?.headers || [];
      const getHeader = (name) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const to      = getHeader('To');
      const from    = getHeader('From');
      const subject = getHeader('Subject');
      const date    = getHeader('Date');

      // ── Build and queue the event ────────────────────────
      await queueAndSync({
        app:         'gmail',
        action_type: 'email.send',
        agent_id:    'detected-via-polling',
        intent:      null,
        metadata: {
          message_id: msg.id,
          thread_id:  msgData.threadId,
          to:         to ? [to] : [],
          from:       from,
          subject:    subject,
          sent_at:    date || new Date().toISOString(),
        },
        before_snapshot: {
          content:      null,
          content_type: 'text/plain',
        },
        after_snapshot: {
          message_id: msg.id,
          thread_id:  msgData.threadId,
          sent_at:    date || new Date().toISOString(),
        },
      });

      console.log('[Trailback] Detected sent email via polling:', subject || '(no subject)');
    }

  } catch (err) {
    console.warn('[Trailback] Gmail polling error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Alarm listener
// ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_FLUSH) {
    flushQueue().catch((err) =>
      console.error('[Trailback] Alarm flush error:', err)
    );
  }

  if (alarm.name === ALARM_POLL) {
    pollGmailSentFolder().catch((err) =>
      console.error('[Trailback] Alarm poll error:', err)
    );
  }
});

// ─────────────────────────────────────────────────────────────
// Message listener — content scripts send captured events here
// ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRAILBACK_EVENT') {
    queueAndSync(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('[Trailback] queueAndSync error:', err);
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }
});