// ─────────────────────────────────────────────────────────────
// Trailback — Gmail Interceptor
// Runs in the MAIN world to intercept window.fetch calls
// Detects Gmail send API calls and fires events to service worker
// ─────────────────────────────────────────────────────────────

(function interceptGmailSends() {
  // Don't inject twice
  if (window.__trailbackGmailInjected) return;
  window.__trailbackGmailInjected = true;

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [resource, options] = args;
    const url = typeof resource === 'string' ? resource : resource?.url;

    // ── Detect Gmail send API call ────────────────────────────
    const isGmailSend =
      url &&
      url.includes('gmail.googleapis.com') &&
      url.includes('/messages/send');

    if (isGmailSend) {
      let beforeSnapshot = null;

      // ── Capture BEFORE snapshot from request body ─────────
      try {
        if (options?.body) {
          const body = JSON.parse(options.body);

          // Gmail sends emails as base64-encoded RFC 2822 format
          if (body.raw) {
            const decoded = atob(body.raw.replace(/-/g, '+').replace(/_/g, '/'));
            beforeSnapshot = parseRawEmail(decoded);
          } else if (body.message?.raw) {
            const decoded = atob(body.message.raw.replace(/-/g, '+').replace(/_/g, '/'));
            beforeSnapshot = parseRawEmail(decoded);
          }
        }
      } catch (e) {
        // Non-blocking — never interrupt the actual send
        console.warn('[Trailback] Could not parse before snapshot:', e.message);
      }

      // ── Execute the original fetch (actual Gmail send) ────
      const response = await originalFetch.apply(this, args);
      const responseClone = response.clone();

      // ── Capture AFTER snapshot from API response ──────────
      try {
        const data = await responseClone.json();

        const event = {
          type: 'TRAILBACK_EVENT',
          payload: {
            app: 'gmail',
            action_type: 'email.send',
            agent_id: detectAgentId(),
            intent: null,
            metadata: {
              message_id: data.id || null,
              thread_id: data.threadId || null,
              to: beforeSnapshot?.to || [],
              subject: beforeSnapshot?.subject || null,
              sent_at: new Date().toISOString(),
            },
            before_snapshot: {
              content: beforeSnapshot?.body || null,
              content_type: 'text/plain',
            },
            after_snapshot: {
              message_id: data.id || null,
              thread_id: data.threadId || null,
              sent_at: new Date().toISOString(),
            },
          },
        };

        // ── Fire event to service worker ──────────────────
        chrome.runtime.sendMessage(event, (response) => {
          if (chrome.runtime.lastError) {
            // Service worker may be sleeping — queue locally as fallback
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

  /**
   * Parse a raw RFC 2822 email string into structured fields
   * Extracts: to, subject, body
   */
  function parseRawEmail(raw) {
    const lines = raw.split('\r\n').length > 1
      ? raw.split('\r\n')
      : raw.split('\n');

    const result = { to: [], subject: null, body: null };
    let headersDone = false;
    const bodyLines = [];

    for (const line of lines) {
      if (!headersDone) {
        if (line === '') {
          headersDone = true;
          continue;
        }
        if (line.toLowerCase().startsWith('to:')) {
          const toValue = line.substring(3).trim();
          // Handle multiple recipients separated by commas
          result.to = toValue.split(',').map(e => e.trim()).filter(Boolean);
        }
        if (line.toLowerCase().startsWith('subject:')) {
          result.subject = line.substring(8).trim();
        }
      } else {
        bodyLines.push(line);
      }
    }

    result.body = bodyLines.join('\n').trim();
    return result;
  }

  /**
   * Try to detect which AI agent triggered this send
   * Looks for common agent identifiers in the page context
   */
  function detectAgentId() {
    // Check for known agent signatures in the page
    if (window.__claudeAgentId) return window.__claudeAgentId;
    if (window.__trailbackAgentId) return window.__trailbackAgentId;

    // Check URL for agent hints
    const url = window.location.href;
    if (url.includes('claude')) return 'claude-browser';
    if (url.includes('chatgpt')) return 'chatgpt-browser';

    return 'unknown-agent';
  }

  /**
   * Fallback: queue event in localStorage if service worker
   * is unreachable. Service worker will pick this up on next wake.
   */
  function queueEventLocally(payload) {
    try {
      const key = 'trailback_fallback_queue';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ ...payload, queued_at: Date.now() });
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {
      console.warn('[Trailback] Could not queue event locally:', e.message);
    }
  }

  console.log('[Trailback] Gmail interceptor active ✓');
})();