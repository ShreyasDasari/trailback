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
 *
 * AUTH ARCHITECTURE:
 *   Two separate token types are used for two separate purposes:
 *
 *   1. Supabase JWT (getSupabaseToken)
 *      Used as Bearer token on POST /api/v1/events.
 *      Obtained via chrome.identity.launchWebAuthFlow → Supabase OAuth.
 *      Stored in chrome.storage.local as 'supabase_access_token'.
 *
 *   2. Google OAuth token (getGoogleToken)
 *      Used ONLY for direct Gmail REST API calls in pollGmailSentFolder.
 *      Obtained via chrome.identity.getAuthToken.
 *      These are different tokens — a Google OAuth token cannot validate
 *      against Supabase's JWT secret and must never be used as Bearer for
 *      the Trailback backend API.
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

// Supabase project URL — used to construct the OAuth authorize endpoint.
// Must match NEXT_PUBLIC_SUPABASE_URL in the frontend .env.
const SUPABASE_URL      = 'https://peciorerndstfulmplzl.supabase.co';

// Storage keys for the Supabase session
const STORAGE_KEY_TOKEN   = 'supabase_access_token';
const STORAGE_KEY_REFRESH = 'supabase_refresh_token';
const STORAGE_KEY_EXPIRY  = 'supabase_token_expiry';   // epoch ms
const STORAGE_KEY_EMAIL   = 'supabase_user_email';

// ─────────────────────────────────────────────────────────────
// AUTH: getGoogleToken()
// Returns a Google OAuth token for Gmail REST API calls ONLY.
// Do NOT use this for the Trailback backend — it is not a Supabase JWT.
// ─────────────────────────────────────────────────────────────

async function getGoogleToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'No Google token'));
      } else {
        resolve(token);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// AUTH: signInWithSupabase()
// Launches the Supabase Google OAuth flow via chrome.identity.
// On success: stores access_token, refresh_token, expiry, and email
// to chrome.storage.local so getSupabaseToken() can return them.
// ─────────────────────────────────────────────────────────────

export async function signInWithSupabase() {
  const redirectUrl = chrome.identity.getRedirectURL();

  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set('provider', 'google');
  authUrl.searchParams.set('redirect_to', redirectUrl);
  authUrl.searchParams.set('response_type', 'token');

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (redirected) => {
        if (chrome.runtime.lastError || !redirected) {
          reject(new Error(chrome.runtime.lastError?.message || 'Auth flow failed'));
        } else {
          resolve(redirected);
        }
      }
    );
  });

  // Supabase returns the tokens in the URL hash fragment, e.g.:
  // https://...#access_token=xxx&refresh_token=yyy&expires_in=3600&...
  const hash = new URL(responseUrl).hash.substring(1); // strip leading '#'
  const params = new URLSearchParams(hash);

  const accessToken  = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn    = parseInt(params.get('expires_in') || '3600', 10);

  if (!accessToken) {
    throw new Error('No access_token in Supabase OAuth response');
  }

  // Decode user email from JWT middle segment (no signature verification needed here)
  let email = null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    email = payload.email || null;
  } catch {
    // Non-fatal — email display in popup is best-effort
  }

  const expiry = Date.now() + expiresIn * 1000;

  await chrome.storage.local.set({
    [STORAGE_KEY_TOKEN]:   accessToken,
    [STORAGE_KEY_REFRESH]: refreshToken,
    [STORAGE_KEY_EXPIRY]:  expiry,
    [STORAGE_KEY_EMAIL]:   email,
  });

  console.log('[Trailback] Supabase sign-in successful. Email:', email);
  return accessToken;
}

// ─────────────────────────────────────────────────────────────
// AUTH: getSupabaseToken()
// Returns a valid Supabase JWT for the Trailback backend API.
//   1. Reads from chrome.storage.local.
//   2. Returns immediately if token exists and expires > 60s from now.
//   3. If missing or expiring soon, triggers signInWithSupabase().
// Throws if the user has never signed in (flushQueue handles this gracefully).
// ─────────────────────────────────────────────────────────────

async function getSupabaseToken() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_EXPIRY,
  ]);

  const token  = stored[STORAGE_KEY_TOKEN];
  const expiry = stored[STORAGE_KEY_EXPIRY];
  const BUFFER_MS = 60 * 1000; // 60 second buffer before expiry

  if (token && expiry && Date.now() < expiry - BUFFER_MS) {
    return token; // Token is valid and not about to expire
  }

  // Token missing or expiring — re-authenticate
  console.log('[Trailback] Supabase token missing or expiring — re-authenticating...');
  return signInWithSupabase();
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
// Reads pending events from storage and POSTs each to the backend.
// Uses a real Supabase JWT — NOT a Google OAuth token.
// Successful events are removed. Failed ones stay for retry.
//
// Exit conditions:
//   - No token (user not signed in) → warn and return, no crash
//   - 200/201 → success, dequeue event
//   - 409 → duplicate (already stored) → safe to dequeue
//   - 401 → token invalid/expired → clear stored token, return early
//   - Other non-2xx → leave in queue for retry on next alarm cycle
// ─────────────────────────────────────────────────────────────

export async function flushQueue() {
  // Step 1: get a valid Supabase JWT before touching the queue
  let token;
  try {
    token = await getSupabaseToken();
  } catch (err) {
    console.warn('[Trailback] Not signed in to Supabase — skipping flush:', err.message);
    return; // Graceful early exit — no crash, events preserved in queue
  }

  const queue = await getQueue();
  if (queue.length === 0) return;

  console.log(`[Trailback] Flushing ${queue.length} event(s)...`);

  for (const event of queue) {
    try {
      const response = await fetch(EVENTS_ENDPOINT, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify(event),
      });

      // 401 → token rejected — clear it so next flush re-authenticates
      if (response.status === 401) {
        console.warn('[Trailback] Supabase JWT rejected (401) — clearing token for re-auth');
        await chrome.storage.local.remove([STORAGE_KEY_TOKEN, STORAGE_KEY_EXPIRY]);
        return; // Stop flushing — re-auth will happen on next alarm cycle
      }

      // 409 → duplicate idempotency key → already stored, safe to dequeue
      // 2xx → success
      const isSuccess = response.ok || response.status === 409;
      if (!isSuccess) {
        console.warn(`[Trailback] Backend rejected event ${event.id}: HTTP ${response.status}`);
        continue; // Leave in queue for retry
      }

      await clearEvent(event.id);
      console.log('[Trailback] Event synced and cleared:', event.id,
        response.status === 409 ? '(duplicate — already stored)' : '');

    } catch (err) {
      console.warn(`[Trailback] Network error for event ${event.id}:`, err.message);
      // Network error → leave in queue for retry
    }
  }
}

// ─────────────────────────────────────────────────────────────
// pollGmailSentFolder()
//
// Polls Gmail Sent folder every 60 seconds for new emails.
// Uses a GOOGLE OAuth token (getGoogleToken) — NOT the Supabase JWT.
// These are two different tokens for two different APIs.
// ─────────────────────────────────────────────────────────────

async function pollGmailSentFolder() {
  try {
    // Use getGoogleToken here — this is the correct token for Gmail REST API
    const token = await getGoogleToken();

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

  // Popup requests a sign-in trigger
  if (message.type === 'TRAILBACK_SIGN_IN') {
    signInWithSupabase()
      .then((token) => sendResponse({ ok: true, token }))
      .catch((err) => {
        console.error('[Trailback] Sign-in failed:', err);
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }

  // Popup requests auth status
  if (message.type === 'TRAILBACK_AUTH_STATUS') {
    chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_EXPIRY, STORAGE_KEY_EMAIL])
      .then((stored) => {
        const token  = stored[STORAGE_KEY_TOKEN];
        const expiry = stored[STORAGE_KEY_EXPIRY];
        const isValid = !!(token && expiry && Date.now() < expiry - 60000);
        sendResponse({
          signedIn: isValid,
          email:    isValid ? stored[STORAGE_KEY_EMAIL] : null,
        });
      })
      .catch(() => sendResponse({ signedIn: false, email: null }));

    return true;
  }
});