# 02 — User Stories & Acceptance Criteria
**Project:** Trailback
**Version:** 1.0
**Last Updated:** February 2026

---

## Personas Reference

| Persona | Role | Core Need |
|---------|------|-----------|
| **Alex** | Ops Manager | Know exactly what the agent did and undo it without calling an engineer |
| **Priya** | Security-conscious CTO | Audit-ready export of every agent action for compliance |
| **Marcus** | Power User PM | Safety net — catch the 1-in-50 actions that go subtly wrong |

---

## Epic 1 — Extension Install & Onboarding

### US-001 — Install and connect
**As** Marcus, a power user,
**I want** to install the Trailback extension and connect my Google account in under 5 minutes,
**So that** I can start recording agent actions immediately without reading documentation.

**Acceptance Criteria:**
- [ ] Extension installs from Chrome Web Store in one click
- [ ] First-run popup prompts Google OAuth sign-in
- [ ] After sign-in, Gmail and Docs connectors are authorised automatically using the same Google token
- [ ] A "setup complete" confirmation screen shows which apps are connected
- [ ] Time from install to first connected app < 5 minutes

### US-002 — Connect Slack separately
**As** Alex, an ops manager,
**I want** to connect Slack as a separate step after Google,
**So that** I have explicit control over which apps Trailback monitors.

**Acceptance Criteria:**
- [ ] Settings page shows three connector cards: Gmail, Google Docs, Slack
- [ ] Each card shows status: Connected / Disconnected / Error
- [ ] "Connect Slack" opens Slack OAuth in a new tab
- [ ] After authorisation, Slack card updates to "Connected" without page refresh
- [ ] Disconnecting removes the OAuth token and marks connector as "Disconnected"

---

## Epic 2 — Event Recording

### US-010 — Gmail send is captured
**As** Marcus,
**I want** every email my AI agent sends via Gmail to be automatically logged,
**So that** I always know exactly what went out on my behalf.

**Acceptance Criteria:**
- [ ] Given the extension is active on `mail.google.com` and an AI agent sends an email via the Gmail API
- [ ] Then a new event appears in the Trailback timeline within 2 seconds
- [ ] And the event contains: recipient(s), subject line, email body snapshot, message ID, thread ID
- [ ] And the event is correctly attributed to the agent identifier
- [ ] And if the backend is temporarily unavailable, the event is queued locally and synced automatically

### US-011 — Google Docs edit is captured
**As** Marcus,
**I want** every document edit made by an AI agent to be captured with a before/after snapshot,
**So that** I can understand exactly what changed in any document.

**Acceptance Criteria:**
- [ ] Given the extension is active on `docs.google.com` and an AI agent triggers a document save
- [ ] Then a new event appears in the timeline within 5 seconds
- [ ] And the event stores the before revision ID and after revision ID from the Drive API
- [ ] And a diff is computable from before/after content

### US-012 — Slack message is captured
**As** Alex,
**I want** every Slack message posted by an AI agent to be logged with channel and content,
**So that** I can trace what the agent communicated and to whom.

**Acceptance Criteria:**
- [ ] Given the extension is active on `app.slack.com` and an AI agent posts a message
- [ ] Then a new event appears in the timeline within 2 seconds
- [ ] And the event contains: message text, channel ID, channel type (public/private/DM), `ts` timestamp
- [ ] And the risk badge shows MEDIUM or higher for public channel posts

### US-013 — Non-blocking capture
**As** any user,
**I want** the extension to never slow down or interrupt my agent's actions,
**So that** using Trailback doesn't add friction to my workflow.

**Acceptance Criteria:**
- [ ] The fetch interceptor in the main world adds < 50ms overhead to any API call
- [ ] If the extension's service worker is inactive, the agent's action still completes normally
- [ ] If event sync to the backend fails, the action is not retried or interrupted

---

## Epic 3 — Timeline & Dashboard

### US-020 — Real-time timeline
**As** Marcus,
**I want** to see a live feed of all agent actions as they happen,
**So that** I can monitor what the agent is doing in real-time.

**Acceptance Criteria:**
- [ ] Timeline shows events in reverse-chronological order (newest at top)
- [ ] New events appear at the top within 2 seconds of capture, without page refresh
- [ ] Each event card shows: app icon, action in plain English, time ago, agent name, risk badge
- [ ] Timeline loads the first 20 events on page load and supports infinite scroll

### US-021 — Filter timeline
**As** Alex,
**I want** to filter the timeline by app and risk level,
**So that** I can quickly find high-risk actions that need attention.

**Acceptance Criteria:**
- [ ] Filter bar shows toggle buttons for: Gmail, Google Docs, Slack
- [ ] Filter bar shows dropdown for risk level: All / Low / Medium / High / Critical
- [ ] Filters are applied immediately without page reload
- [ ] Active filters persist across page navigations within the same session
- [ ] "Clear filters" button resets to default view

### US-022 — Diff view
**As** Marcus,
**I want** to see an exact before/after comparison for any document edit,
**So that** I can verify what the agent changed without opening the original document.

**Acceptance Criteria:**
- [ ] Clicking any Docs event opens the diff view
- [ ] Diff view shows side-by-side panels: Before (left, red removals) and After (right, green additions)
- [ ] Toggle between split view and unified view
- [ ] Metadata panel shows: agent name, timestamp, intent (if logged), risk score explanation
- [ ] "Rollback this action" CTA is visible at the bottom of the diff view

---

## Epic 4 — Rollback

### US-030 — Gmail rollback
**As** Alex,
**I want** to undo a Gmail send with one click,
**So that** I can quickly recover from a mistake without manually finding and trashing emails.

**Acceptance Criteria:**
- [ ] Given a Gmail send event with `rollback_status = "available"`
- [ ] When the user clicks "Rollback" and confirms in the modal
- [ ] Then the email is moved to Gmail Trash within 5 seconds
- [ ] And `rollback_status` updates to `"executed"` and is reflected immediately in the UI
- [ ] And the Rollback button becomes permanently disabled
- [ ] And a success banner shows: "Email moved to Gmail Trash"

### US-031 — Rollback confirmation modal
**As** any user,
**I want** to see a plain-English description of what will be reversed before I confirm,
**So that** I never accidentally undo the wrong thing.

**Acceptance Criteria:**
- [ ] Clicking Rollback opens a modal, not an immediate action
- [ ] Modal shows: what will happen ("This will move your email to trash"), which app, which action
- [ ] Modal has two clear buttons: "Confirm Rollback" (destructive, red) and "Cancel"
- [ ] Pressing Escape or clicking outside closes the modal with no action taken

### US-032 — Rollback failure handling
**As** any user,
**I want** to understand clearly why a rollback failed,
**So that** I know what manual action I need to take instead.

**Acceptance Criteria:**
- [ ] If a Slack message is outside the 90-second deletion window, show: "This message can't be deleted automatically — it was sent more than 90 seconds ago. Delete it manually in Slack."
- [ ] If an OAuth token has expired, show: "Your Gmail authorisation has expired. Reconnect Gmail in Settings."
- [ ] Failed rollbacks are logged with a reason visible in the event detail page
- [ ] Failed rollbacks do not update `rollback_status` to "executed"

### US-033 — Google Docs rollback
**As** Marcus,
**I want** to restore a document to its pre-edit state with one click,
**So that** I don't need to manually navigate Drive revision history.

**Acceptance Criteria:**
- [ ] Given a Docs edit event with `rollback_status = "available"`
- [ ] When the user confirms the rollback
- [ ] Then the document is restored to the before revision via the Drive API within 10 seconds
- [ ] And a new rollback event is appended to the log
- [ ] And the original edit event's status updates to `"rolled_back"`

---

## Epic 5 — Audit & Settings

### US-040 — Audit trail export
**As** Priya,
**I want** to export a CSV of all agent actions for a given date range,
**So that** I can provide it to our compliance auditor.

**Acceptance Criteria:**
- [ ] Audit page has date range picker and "Export CSV" button
- [ ] CSV contains columns: event_id, timestamp, agent_name, app, action_type, risk_level, rollback_status, metadata_summary
- [ ] Export covers the full selected date range (up to retention limit)
- [ ] Download begins within 3 seconds of clicking Export

### US-041 — Risk badge transparency
**As** any user,
**I want** to understand why an event was classified as HIGH or CRITICAL,
**So that** I can calibrate trust in the classification.

**Acceptance Criteria:**
- [ ] Clicking any risk badge opens a tooltip showing: risk score (0–100), list of reasons (e.g., "Email sent to 12 recipients", "Posted to public Slack channel")
- [ ] Reasons are written in plain English, not code
