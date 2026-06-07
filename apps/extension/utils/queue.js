/**
 * apps/extension/utils/queue.js
 *
 * Low-level helpers for reading and writing the event queue in
 * chrome.storage.local. These are the only functions that should
 * touch the storage key directly — everything else goes through here.
 *
 * Storage shape:
 *   chrome.storage.local = {
 *     event_queue: [
 *       { id: string, queued_at: number, synced: boolean, ...eventFields },
 *       ...
 *     ]
 *   }
 */

const QUEUE_KEY = 'event_queue';

// ---------------------------------------------------------------------------
// getQueue()
// Returns the full array of queued events.
// Always returns an array — never null or undefined.
// ---------------------------------------------------------------------------

export async function getQueue() {
    const result = await chrome.storage.local.get(QUEUE_KEY);
    return result[QUEUE_KEY] ?? [];
}

// ---------------------------------------------------------------------------
// saveQueue(queue)
// Overwrites the entire queue in storage.
// Pass the full array you want persisted.
// ---------------------------------------------------------------------------

export async function saveQueue(queue) {
    if (!Array.isArray(queue)) {
        throw new TypeError('[Trailback] saveQueue expects an array');
    }
    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

// ---------------------------------------------------------------------------
// clearEvent(eventId)
// Removes a single event from the queue by its id.
// Used after a successful POST to the backend.
// ---------------------------------------------------------------------------

export async function clearEvent(eventId) {
    const queue = await getQueue();
    const updated = queue.filter((event) => event.id !== eventId);
    await saveQueue(updated);
}