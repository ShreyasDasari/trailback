/**
 * content-scripts/extension-bridge.js
 *
 * Runs silently on ALL trailback-ai.vercel.app pages (isolated world).
 *
 * PURPOSE — Single Sign-On UX:
 *   When a user signs into the Trailback web app, this script automatically
 *   relays their Supabase session to the extension's chrome.storage.local,
 *   so the extension shows "Recording" without any separate sign-in step.
 *
 * HOW IT WORKS:
 *   The Supabase JS client stores the session in localStorage under the key:
 *     sb-{project-ref}-auth-token
 *   This content script reads that key on every page load and, if the session
 *   is valid and not yet known to the extension, sends TRAILBACK_SET_TOKEN.
 *
 * SECURITY:
 *   The token only travels from the web app's page → extension's service
 *   worker via chrome.runtime.sendMessage. It never leaves the browser.
 */

(function () {
  'use strict';

  // Supabase project ref — matches NEXT_PUBLIC_SUPABASE_URL project ID
  const SUPABASE_LS_KEY  = 'sb-peciorerndstfulmplzl-auth-token';
  // Legacy one-time handoff key (kept for backward compat with /auth/success page)
  const HANDOFF_KEY      = 'trailback_ext_handoff';

  /**
   * Read the active Supabase session from localStorage and relay it to
   * the extension service worker, but only if the session is valid.
   */
  function syncSessionToExtension() {
    let session = null;

    // 1. Try the live Supabase client session (primary)
    try {
      const raw = localStorage.getItem(SUPABASE_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Supabase stores: { access_token, refresh_token, expires_at, user, ... }
        session = parsed;
      }
    } catch { /* localStorage restricted or malformed */ }

    // 2. Fallback: one-time handoff key written by /auth/success page
    if (!session) {
      try {
        const raw = localStorage.getItem(HANDOFF_KEY);
        if (raw) {
          session = JSON.parse(raw);
          localStorage.removeItem(HANDOFF_KEY); // one-time use
        }
      } catch { /* non-fatal */ }
    }

    if (!session?.access_token) return;

    // Don't relay expired tokens (expires_at is epoch seconds)
    if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) return;

    chrome.runtime.sendMessage({
      type:          'TRAILBACK_SET_TOKEN',
      access_token:  session.access_token,
      refresh_token: session.refresh_token  || null,
      expires_at:    session.expires_at     || null, // epoch seconds
    }, (response) => {
      if (chrome.runtime.lastError) return; // extension not ready yet — non-fatal
      if (response?.ok) {
        console.debug('[Trailback] Session synced to extension ✓');
      }
    });
  }

  // Run on initial page load
  syncSessionToExtension();

  // Re-run when Next.js navigates (SPA route changes fire popstate)
  window.addEventListener('popstate', syncSessionToExtension);

  // Also listen for the explicit one-time handoff event from /auth/success
  window.addEventListener('trailback_session_ready', syncSessionToExtension, { once: true });
})();
