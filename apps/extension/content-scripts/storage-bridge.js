// ─────────────────────────────────────────────────────────────
// Trailback — Storage Bridge
//
// Runs in the ISOLATED world (no "world":"MAIN" in manifest).
// Receives window.postMessage events from the MAIN-world interceptors
// when chrome.runtime.sendMessage fails (e.g. service worker sleeping),
// and writes them directly to chrome.storage.local via queue.js helpers.
//
// Why this file exists:
//   MAIN-world scripts cannot access chrome.storage directly.
//   localStorage is per-origin/per-context and is never read by the
//   service worker — events queued there are permanently lost.
//   This bridge closes that gap: MAIN world → postMessage → isolated
//   world → chrome.storage.local → service worker flushQueue().
// ─────────────────────────────────────────────────────────────

import { getQueue, saveQueue } from '../utils/queue.js';

const QUEUE_KEY = 'event_queue';

window.addEventListener('message', async (event) => {
    // Only handle our own fallback messages
    if (!event.data || event.data.type !== 'TRAILBACK_FALLBACK_QUEUE') return;

    // Ignore messages from other origins (security)
    if (event.origin !== window.location.origin) return;

    const payload = event.data.payload;
    if (!payload || !payload.id) {
        console.warn('[Trailback Bridge] Received malformed fallback payload — skipping');
        return;
    }

    try {
        const queue = await getQueue();

        // Deduplication: skip if this id is already queued
        if (queue.some((e) => e.id === payload.id)) {
            console.log('[Trailback Bridge] Duplicate fallback event ignored:', payload.id);
            return;
        }

        queue.push({ ...payload, synced: false });
        await saveQueue(queue);

        console.log('[Trailback Bridge] Fallback event written to chrome.storage.local:', payload.id);
    } catch (err) {
        console.error('[Trailback Bridge] Failed to write fallback event to storage:', err);
    }
});

console.log('[Trailback] Storage bridge active ✓');
