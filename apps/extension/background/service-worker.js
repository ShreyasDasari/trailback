/**
 * apps/extension/background/service-worker.js
 *
 * Trailback — MV3 Service Worker
 * Responsibilities:
 *   - Receive events from content scripts via chrome.runtime.sendMessage
 *   - Persist every event to chrome.storage.local immediately (queue-first)
 *   - Flush the queue to the backend API on a 30-second alarm interval
 *   - Attempt an immediate flush on each new event (best-effort)
 *
 * NOTE: Auth is not wired up yet. A dummy Bearer token is hardcoded below.
 *       Replace DUMMY_TOKEN with real token logic when auth is implemented.
 */

import { getQueue, saveQueue, clearEvent } from '../utils/queue.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = 'http://localhost:8000';
const EVENTS_ENDPOINT = `${API_BASE}/api/v1/events`;
const ALARM_NAME = 'trailback-flush';
const FLUSH_INTERVAL_MINUTES = 0.5; // 30 seconds

// TODO: Replace with real token from chrome.identity / Supabase Auth
const DUMMY_TOKEN = 'dummy-bearer-token-replace-me';

// ---------------------------------------------------------------------------
// Installation — set up the recurring alarm once
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: FLUSH_INTERVAL_MINUTES,
    });
    console.log('[Trailback] Extension installed. Flush alarm created.');
});

// Also recreate the alarm on service worker startup (alarms survive worker
// termination but this is a safety net for dev reloads).
chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
        chrome.alarms.create(ALARM_NAME, {
            periodInMinutes: FLUSH_INTERVAL_MINUTES,
        });
    }
});

// ---------------------------------------------------------------------------
// queueAndSync(event)
//
// The main entry point for all captured events.
//   1. Stamps the event with a UUID and timestamp.
//   2. Appends it to chrome.storage.local immediately.
//   3. Attempts a non-blocking flush right away (best-effort).
// ---------------------------------------------------------------------------

export async function queueAndSync(event) {
    const stamped = {
        ...event,
        id: crypto.randomUUID(),
        queued_at: Date.now(),
        synced: false,
    };

    try {
        const queue = await getQueue();
        queue.push(stamped);
        await saveQueue(queue);
        console.log('[Trailback] Event queued:', stamped.id, stamped);
    } catch (err) {
        console.error('[Trailback] Failed to queue event:', err);
        return;
    }

    // Best-effort immediate flush — don't await, don't block
    flushQueue().catch((err) =>
        console.warn('[Trailback] Immediate flush failed (will retry on alarm):', err)
    );
}

// ---------------------------------------------------------------------------
// flushQueue()
//
// Reads all pending (unsynced) events from storage and POSTs each one to the
// backend. On success the event is removed from the queue. On failure it stays
// and will be retried on the next alarm tick.
// ---------------------------------------------------------------------------

export async function flushQueue() {
    const queue = await getQueue();

    if (queue.length === 0) {
        return; // Nothing to do
    }

    console.log(`[Trailback] Flushing ${queue.length} event(s)...`);

    for (const event of queue) {
        try {
            const response = await fetch(EVENTS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${DUMMY_TOKEN}`,
                },
                body: JSON.stringify(event),
            });

            if (!response.ok) {
                // Leave in queue and retry later
                console.warn(
                    `[Trailback] Backend rejected event ${event.id}: ${response.status} ${response.statusText}`
                );
                continue;
            }

            // Successfully synced — remove from queue
            await clearEvent(event.id);
            console.log('[Trailback] Event synced and cleared:', event.id);
        } catch (err) {
            // Network error — leave in queue and retry later
            console.warn(`[Trailback] Network error for event ${event.id}:`, err.message);
        }
    }
}

// ---------------------------------------------------------------------------
// Alarm listener — guaranteed flush every 30 seconds
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        flushQueue().catch((err) =>
            console.error('[Trailback] Alarm-triggered flush error:', err)
        );
    }
});

// ---------------------------------------------------------------------------
// Message listener — content scripts send captured events here
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRAILBACK_EVENT') {
        queueAndSync(message.payload)
            .then(() => sendResponse({ ok: true }))
            .catch((err) => {
                console.error('[Trailback] queueAndSync error:', err);
                sendResponse({ ok: false, error: err.message });
            });

        // Return true to keep the message channel open for the async response
        return true;
    }
});