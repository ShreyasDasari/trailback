# 03 — Information Architecture
**Project:** Trailback
**Version:** 1.0
**Last Updated:** February 2026

---

## 1. Overview

This document defines the complete navigational structure, page hierarchy, content objects, and interaction flows for the Trailback web dashboard and Chrome extension popup.

---

## 2. Site Map

```
trailback.ai (web app)
│
├── / (root)
│   └── Redirect → /login (unauthenticated) or /timeline (authenticated)
│
├── /login
│   └── Google OAuth sign-in
│
├── /onboarding
│   ├── Step 1: Extension detected?
│   ├── Step 2: Connect Gmail + Google Docs (same Google OAuth)
│   └── Step 3: Connect Slack (separate OAuth)
│
├── /timeline                          ← PRIMARY VIEW
│   ├── Filter bar (app, risk, date)
│   ├── Event feed (infinite scroll)
│   └── Event Card → /event/:id
│
├── /event/:id
│   ├── Event metadata panel
│   ├── /event/:id/diff                ← DIFF VIEW
│   │   ├── Before panel
│   │   ├── After panel
│   │   └── Rollback CTA
│   └── /event/:id/rollback            ← ROLLBACK CONFIRM
│       ├── What will be reversed
│       ├── Confirm button
│       └── Cancel
│
├── /audit                             ← AUDIT TRAIL
│   ├── Date range picker
│   ├── Events table (paginated)
│   └── Export CSV button
│
├── /settings
│   ├── /settings/connectors           ← CONNECTOR MANAGEMENT
│   │   ├── Gmail card (connect/disconnect)
│   │   ├── Google Docs card
│   │   └── Slack card
│   ├── /settings/agents               ← AGENT REGISTRY
│   │   ├── Registered agents list
│   │   ├── Trust score per agent
│   │   └── Register new agent (copy API key)
│   └── /settings/account
│       ├── Profile info
│       ├── Log retention display
│       └── Sign out
│
└── /health (internal — no nav)
```

---

## 3. Chrome Extension Popup Map

```
Extension Popup (popup.html)
│
├── Header: "Trailback" + status dot (recording / paused / error)
├── Connected apps strip (Gmail ✓ | Docs ✓ | Slack ✗)
├── Last event preview (most recent action, time ago)
├── "Open Dashboard" → opens trailback.ai/timeline in new tab
└── Footer: "Settings" → opens trailback.ai/settings
```

---

## 4. Content Objects

### 4.1 Event Card (Timeline View)

```
┌─────────────────────────────────────────────────────────┐
│  [App Icon]  Email sent to 3 recipients          2m ago  │
│              john@co.com + 2 others · "Q4 update"        │
│  [Agent: claude-desktop]          [MEDIUM ▼]  [Rollback] │
└─────────────────────────────────────────────────────────┘
```

Fields shown:
- App icon (Gmail / Docs / Slack)
- Action description (plain English)
- Time ago (relative, updates in real-time)
- Recipient/target preview
- Agent name
- Risk badge (colour-coded)
- Rollback button (or status label if executed/unavailable)

### 4.2 Diff View Layout

```
┌──────────────────────────────────────────────────────────────┐
│  BEFORE                         │  AFTER                       │
│  ─────────────────────────────  │  ───────────────────────────  │
│  The project timeline is        │  The project timeline is      │
│- currently on track for Q1.     │+ delayed to Q2 due to scope.  │
│  We expect delivery by March.   │  We expect delivery by June.  │
└──────────────────────────────────────────────────────────────┘
│  Agent: claude-desktop · Feb 23, 2026 14:32 · Risk: LOW        │
│  ──────────────────────────────────────────────────────────── │
│                        [Rollback This Edit]                    │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Rollback Confirmation Modal

```
┌──────────────────────────────────────┐
│  ⚠️  Confirm Rollback                 │
│                                      │
│  This will restore "Q4 Roadmap"      │
│  to its state before claude-desktop  │
│  edited it on Feb 23 at 14:32.       │
│                                      │
│  The current version will be         │
│  replaced with the prior revision.   │
│                                      │
│  [Cancel]    [Confirm Rollback →]    │
└──────────────────────────────────────┘
```

### 4.4 Connector Card (Settings)

```
┌─────────────────────────────────────────┐
│  [Gmail logo]  Gmail                    │
│  Status: ● Connected                    │
│  Scopes: gmail.modify                   │
│  Connected: Feb 20, 2026                │
│                          [Disconnect]   │
└─────────────────────────────────────────┘
```

---

## 5. Navigation Structure

### Primary Navigation (left sidebar)

```
[TB] Trailback
─────────────────
⏱  Timeline         ← default landing
📋  Audit Trail
─────────────────
⚙️  Settings
  └ Connectors
  └ Agents
  └ Account
```

### Secondary Navigation (event detail)

```
← Back to Timeline
[Event metadata tabs: Overview | Diff | Rollback History]
```

---

## 6. User Flows

### Flow 1: First-Time Setup

```
Install extension
    → Click extension icon
    → Popup prompts "Sign in to start recording"
    → Click "Sign in with Google"
    → Google OAuth completes
    → Redirect to /onboarding
    → Step 1: Gmail + Docs connected (same token)
    → Step 2: "Connect Slack" CTA
    → Step 3: "You're recording" success screen
    → Redirect to /timeline (empty state)
```

### Flow 2: Reviewing an Action

```
AI agent sends email
    → Event appears in /timeline (real-time)
    → User clicks event card
    → /event/:id opens (metadata panel)
    → User clicks "View Diff"
    → /event/:id/diff opens (before/after email body)
    → User satisfied → back to timeline
```

### Flow 3: Rolling Back an Action

```
User sees unexpected edit in /timeline
    → Clicks event card → diff view
    → Clicks "Rollback This Edit"
    → Confirmation modal opens
    → User reads plain-English description
    → Clicks "Confirm Rollback"
    → Modal closes, progress spinner on event card
    → "✓ Rolled back" label replaces Rollback button
    → Rollback logged in audit trail
```

### Flow 4: Exporting Audit Trail

```
Compliance request received
    → Navigate to /audit
    → Set date range (last 30 days)
    → Click "Export CSV"
    → Browser downloads trailback-audit-2026-02.csv
    → File contains all events in the selected range
```

---

## 7. Empty States

| Page | Empty State Message |
|------|---------------------|
| /timeline | "No actions recorded yet. Make sure the extension is installed and an AI agent is active." |
| /timeline (filtered) | "No actions match your current filters. [Clear filters]" |
| /audit | "No events in this date range." |
| /settings/agents | "No agents registered. [Register your first agent →]" |

---

## 8. Error States

| Scenario | UI Behaviour |
|----------|-------------|
| Backend unreachable | Yellow banner: "Trailback is temporarily offline. Events are being queued locally and will sync when reconnected." |
| OAuth token expired | Red connector card badge: "Reconnect required" + inline reconnect button |
| Rollback failed | Red inline error on event card with plain-English reason + "Retry" button |
| Extension not installed | Dashboard banner: "Extension not detected. [Install Extension →]" |

---

## 9. Responsive Behaviour

| Breakpoint | Layout Change |
|-----------|--------------|
| > 1280px | Sidebar expanded with labels |
| 768–1280px | Sidebar collapsed to icons only |
| < 768px | Bottom tab nav, single-column timeline |
| < 480px | Mobile: simplified event cards (no diff CTA), full-screen modal |

The Diff view and Audit table are desktop-first and show a "best viewed on desktop" notice on mobile.
