// ─────────────────────────────────────────────────────────────
// Trailback — Google Docs Interceptor
// Runs in the MAIN world to intercept window.fetch calls
// Detects Google Docs auto-save API calls and fires events to service worker
// ─────────────────────────────────────────────────────────────

(function interceptDocsSaves() {
    // Don't inject twice
    if (window.__trailbackDocsInjected) return;
    window.__trailbackDocsInjected = true;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const [resource, options] = args;
        const url = typeof resource === 'string' ? resource : resource?.url;

        // ── Detect Google Docs auto-save API call ─────────────────
        const isDocsSave =
            url &&
            url.includes('docs.googleapis.com/v1/documents/') &&
            (options?.method?.toUpperCase() === 'PATCH' ||
                options?.method?.toUpperCase() === 'POST');

        if (isDocsSave) {
            // ── Extract document ID from URL ──────────────────────
            let documentId = null;
            try {
                const match = url.match(/\/v1\/documents\/([^/?]+)/);
                documentId = match ? match[1] : null;
            } catch (e) { /* non-blocking */ }

            // ── Capture BEFORE snapshot from request body ─────────
            let beforeSnapshot = null;
            try {
                if (options?.body) {
                    beforeSnapshot = typeof options.body === 'string'
                        ? JSON.parse(options.body)
                        : options.body;
                }
            } catch (e) {
                console.warn('[Trailback] Could not parse before snapshot:', e.message);
            }

            // ── Execute the original fetch (actual Docs save) ─────
            const response = await originalFetch.apply(this, args);
            const responseClone = response.clone();

            // ── Capture AFTER snapshot from API response ──────────
            try {
                const data = await responseClone.json();

                const event = {
                    type: 'TRAILBACK_EVENT',
                    payload: {
                        app: 'gdocs',
                        action_type: 'doc.edit',
                        agent_id: detectAgentId(),
                        intent: null,
                        idempotency_key: crypto.randomUUID(),
                        metadata: {
                            document_id: documentId,
                            file_id:     documentId,
                            revision_id: data.revisionId || null,
                            title: data.title || null,
                            url: window.location.href,
                        },
                        before_snapshot: {
                            requests: beforeSnapshot,
                            content_type: 'application/json',
                            captured_at: new Date().toISOString(),
                        },
                        after_snapshot: {
                            revision_id: data.revisionId || null,
                            document_id: data.documentId || documentId,
                            saved_at: new Date().toISOString(),
                        },
                    },
                };

                // ── Fire event to service worker ──────────────────
                chrome.runtime.sendMessage(event, (response) => {
                    if (chrome.runtime.lastError) {
                        queueEventLocally(event.payload);
                    }
                });

            } catch (e) {
                console.warn('[Trailback] Could not parse after snapshot:', e.message);
            }

            return response;
        }

        // ── All other fetch calls pass through untouched ──────────
        return originalFetch.apply(this, args);
    };

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    function detectAgentId() {
        if (window.__claudeAgentId) return window.__claudeAgentId;
        if (window.__trailbackAgentId) return window.__trailbackAgentId;

        const url = window.location.href;
        if (url.includes('claude')) return 'claude-browser';
        if (url.includes('chatgpt')) return 'chatgpt-browser';

        return 'unknown-agent';
    }

    /**
     * Fallback: relay via window.postMessage to storage-bridge.js
     * (isolated-world script that writes to chrome.storage.local).
     * localStorage is NOT accessible to the service worker and events
     * written there are permanently lost — this bridge fixes that.
     */
    function queueEventLocally(payload) {
        try {
            window.postMessage({
                type: 'TRAILBACK_FALLBACK_QUEUE',
                payload: { ...payload, id: crypto.randomUUID(), queued_at: Date.now() },
            }, '*');
        } catch (e) {
            console.warn('[Trailback] Could not relay event to storage bridge:', e.message);
        }
    }

    console.log('[Trailback] Google Docs interceptor active ✓');
})();