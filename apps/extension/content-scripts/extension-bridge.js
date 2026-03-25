/**
 * content-scripts/extension-bridge.js
 *
 * Runs on the Trailback web app domain ONLY (see manifest content_scripts).
 * After the user completes Google sign-in on the web app, the /auth/success
 * page writes the Supabase session to localStorage under 'trailback_ext_handoff'.
 * This script reads that key and relays the tokens to the service worker so the
 * extension is authenticated without any launchWebAuthFlow call.
 *
 * One-time handoff: the key is deleted immediately after reading.
 */

(function () {
  'use strict';

  const HANDOFF_KEY = 'trailback_ext_handoff';

  function tryHandoff() {
    let raw;
    try {
      raw = localStorage.getItem(HANDOFF_KEY);
    } catch {
      return; // localStorage not available (e.g. incognito with restrictions)
    }

    if (!raw) return;

    let session;
    try {
      session = JSON.parse(raw);
    } catch {
      localStorage.removeItem(HANDOFF_KEY);
      return;
    }

    const { access_token, refresh_token, expires_at } = session;
    if (!access_token) {
      localStorage.removeItem(HANDOFF_KEY);
      return;
    }

    // Relay to service worker
    chrome.runtime.sendMessage({
      type: 'TRAILBACK_SET_TOKEN',
      access_token,
      refresh_token: refresh_token || null,
      expires_at,   // epoch seconds from Supabase
    }, (response) => {
      if (response?.ok) {
        console.log('[Trailback Bridge] Session relayed to extension ✓');
      } else {
        console.warn('[Trailback Bridge] Relay failed:', response?.error);
      }
    });

    // One-time handoff — remove immediately
    localStorage.removeItem(HANDOFF_KEY);
  }

  // Run on document load — also retry on route changes (Next.js SPA)
  tryHandoff();
  window.addEventListener('trailback_session_ready', tryHandoff, { once: true });
})();
