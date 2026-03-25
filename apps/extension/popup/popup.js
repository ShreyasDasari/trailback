/**
 * popup.js — Trailback Extension Popup
 *
 * Handles auth state display, sign-in/sign-out, and dashboard navigation.
 * Separated from popup.html for MV3 CSP compliance (no inline scripts).
 */

'use strict';

// Production dashboard URL — never localhost
const DASHBOARD_URL = 'https://trailback-e1m115036-shreyasdasaris-projects.vercel.app';

// ── Elements ────────────────────────────────────────────────────────────────

const signedOutEl     = document.getElementById('signed-out');
const signedInEl      = document.getElementById('signed-in');
const statusRecording = document.getElementById('status-recording');
const statusOffline   = document.getElementById('status-offline');

const signinBtn       = document.getElementById('btn-signin');
const signinLabel     = document.getElementById('signin-label');
const openWebappBtn   = document.getElementById('btn-open-webapp');

const userAvatar      = document.getElementById('user-avatar');
const userEmail       = document.getElementById('user-email');
const signOutBtn      = document.getElementById('btn-signout');
const dashboardBtn    = document.getElementById('btn-dashboard');
const slackConnectBtn = document.getElementById('btn-slack-connect');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Set dashboard link to production URL + optional path */
function setDashboardHref(path = '') {
  dashboardBtn.href = DASHBOARD_URL + path;
}

/** Show signed-in UI */
function showSignedIn(email) {
  signedOutEl.style.display  = 'none';
  signedInEl.style.display   = 'block';
  statusRecording.classList.remove('hidden');
  statusOffline.classList.add('hidden');

  if (email) {
    userEmail.textContent = email;
    // Avatar initial
    const initial = email.split('@')[0]?.[0]?.toUpperCase() || '?';
    userAvatar.textContent = initial;
  }
}

/** Show signed-out UI */
function showSignedOut() {
  signedOutEl.style.display  = 'flex';
  signedInEl.style.display   = 'none';
  statusRecording.classList.add('hidden');
  statusOffline.classList.remove('hidden');
}

// ── On popup load: check auth status ────────────────────────────────────────

setDashboardHref('/timeline');

chrome.runtime.sendMessage({ type: 'TRAILBACK_AUTH_STATUS' }, (response) => {
  if (chrome.runtime.lastError) {
    showSignedOut();
    return;
  }

  if (response?.signedIn) {
    showSignedIn(response.email);
  } else {
    showSignedOut();
  }
});

// ── Sign-in via Supabase OAuth (inside extension) ────────────────────────────

signinBtn.addEventListener('click', () => {
  signinBtn.disabled = true;
  signinLabel.textContent = 'Opening login page…';

  // Opens the web app login in a new tab.
  // extension-bridge.js on that domain will relay the session back.
  chrome.runtime.sendMessage({ type: 'TRAILBACK_SIGN_IN' }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      signinBtn.disabled = false;
      signinLabel.textContent = 'Continue with Google';
      console.error('[Trailback Popup] Failed to open login tab:', chrome.runtime.lastError || response?.error);
      return;
    }

    // Tab opened — update label and poll for session
    signinLabel.textContent = 'Waiting for sign-in…';

    // Poll every 1.5s for up to 90s until the session arrives
    let attempts = 0;
    const maxAttempts = 60;
    const poll = setInterval(() => {
      attempts++;
      chrome.runtime.sendMessage({ type: 'TRAILBACK_AUTH_STATUS' }, (res) => {
        if (res?.signedIn) {
          clearInterval(poll);
          showSignedIn(res.email);
        } else if (attempts >= maxAttempts) {
          clearInterval(poll);
          signinBtn.disabled = false;
          signinLabel.textContent = 'Continue with Google';
        }
      });
    }, 1500);
  });
});

// ── Open web app login page (secondary action) ───────────────────────────────

openWebappBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: `${DASHBOARD_URL}/login` });
});

// ── Sign out ─────────────────────────────────────────────────────────────────

signOutBtn.addEventListener('click', () => {
  chrome.storage.local.remove([
    'supabase_access_token',
    'supabase_refresh_token',
    'supabase_token_expiry',
    'supabase_user_email',
  ], () => {
    showSignedOut();
  });
});

// ── Slack rollback → open Connectors page ────────────────────────────────────

slackConnectBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: `${DASHBOARD_URL}/settings/connectors` });
});

// ── Dashboard button (also set in HTML via href, this is belt-and-suspenders) ─

dashboardBtn.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${DASHBOARD_URL}/timeline` });
});
