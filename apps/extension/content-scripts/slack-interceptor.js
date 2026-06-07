// ─────────────────────────────────────────────────────────────
// Trailback — Slack Interceptor
// Runs in the MAIN world to intercept window.fetch calls
// Detects Slack chat.postMessage API calls and fires events to service worker
// ─────────────────────────────────────────────────────────────

(function interceptSlackMessages() {
    // Don't inject twice
    if (window.__trailbackSlackInjected) return;
    window.__trailbackSlackInjected = true;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const [resource, options] = args;
        const url = typeof resource === 'string' ? resource : resource?.url;

        // ── Detect Slack chat.postMessage API call ────────────────
        const isSlackPost =
            url && url.includes('api.slack.com/api/chat.postMessage');

        if (isSlackPost) {
            // ── Capture BEFORE snapshot from request body ─────────
            let text = null;
            let channel = null;
            let channel_type = null;

            try {
                if (options?.body) {
                    // Slack sends as JSON or FormData — handle both
                    if (typeof options.body === 'string') {
                        const body = JSON.parse(options.body);
                        text = body.text || null;
                        channel = body.channel || null;
                        channel_type = body.channel_type || null;
                    } else if (options.body instanceof URLSearchParams || options.body instanceof FormData) {
                        text = options.body.get('text') || null;
                        channel = options.body.get('channel') || null;
                        channel_type = options.body.get('channel_type') || null;
                    }
                }
            } catch (e) {
                console.warn('[Trailback] Could not parse Slack request body:', e.message);
            }

            // ── Execute the original fetch (actual Slack post) ────
            const response = await originalFetch.apply(this, args);
            const responseClone = response.clone();

            // ── Capture AFTER snapshot — ts from response ─────────
            try {
                const data = await responseClone.json();

                if (data.ok) {
                    const event = {
                        type: 'TRAILBACK_EVENT',
                        payload: {
                            app: 'slack',
                            action_type: 'message.post',
                            agent_id: detectAgentId(),
                            intent: null,
                            idempotency_key: crypto.randomUUID(),
                            metadata: {
                                text,
                                channel,
                                channel_type,
                                ts: data.ts || data.message?.ts || null,
                                message_id: data.ts || null,
                            },
                            before_snapshot: null, // No before state for a new message
                            after_snapshot: {
                                ts: data.ts || null,
                                channel: data.channel || channel,
                                sent_at: new Date().toISOString(),
                            },
                        },
                    };

                    // ── Fire event to service worker ────────────────
                    chrome.runtime.sendMessage(event, (response) => {
                        if (chrome.runtime.lastError) {
                            // Service worker may be sleeping — queue locally as fallback
                            queueEventLocally(event.payload);
                        }
                    });
                }
            } catch (e) {
                console.warn('[Trailback] Could not parse Slack response:', e.message);
            }

            return response;
        }

        // ── All other fetch calls pass through untouched ──────────
        return originalFetch.apply(this, args);
    };

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Try to detect which AI agent triggered this message post
     * Looks for common agent identifiers in the page context
     */
    function detectAgentId() {
        if (window.__claudeAgentId) return window.__claudeAgentId;
        if (window.__trailbackAgentId) return window.__trailbackAgentId;

        const url = window.location.href;
        if (url.includes('claude')) return 'claude-browser';
        if (url.includes('chatgpt')) return 'chatgpt-browser';

        return 'unknown-agent';
    }

    /**
     * Fallback: queue event in localStorage if service worker
     * is unreachable. Service worker will pick this up on next wake.
     */
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

    console.log('[Trailback] Slack interceptor active ✓');
})();