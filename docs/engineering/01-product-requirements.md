# 01 — Product Requirements
**Project:** Trailback
**Version:** 1.0
**Status:** Approved
**Last Updated:** February 2026

---

## 1. Product Overview

Trailback is a cross-application **flight recorder and one-click rollback layer** for AI agents. It intercepts, logs, diffs, and makes reversible every action an AI agent takes across Gmail, Google Docs, and Slack — surfaced through a real-time browser dashboard and a Chrome extension.

**Tagline:** *Every agent action, recorded and reversible.*

---

## 2. Problem

As AI agents take real actions — sending emails, editing documents, posting messages — the primary blockers to enterprise adoption are:

- **No unified audit trail.** There is no cross-app, human-readable record of what an agent did, when, and why.
- **No recoverability.** Once an agent sends an email or edits a document, undoing it is manual and time-consuming.
- **No trust signal.** Teams cannot delegate real work to agents without a safety net.

---

## 3. Goals

| Goal | Metric |
|------|--------|
| Give users full visibility into agent actions | 100% of agent actions captured |
| Enable one-click rollback for any eligible action | < 5s rollback execution time |
| Provide a tamper-proof audit trail | Append-only event log, SHA-256 verified |
| Be non-blocking to the user's primary workflow | < 50ms overhead per capture |

---

## 4. Non-Goals (MVP)

- Multi-user team workspaces
- LLM-powered intent summarisation
- Notion, Jira, HubSpot connectors
- Firefox / Safari extension
- Automated rollback policies
- Stripe billing enforcement

---

## 5. Functional Requirements

### 5.1 Recording

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Capture every Gmail send: recipients, subject, body, thread ID, message ID | P0 |
| FR-002 | Capture every Google Docs edit: before revision ID, after revision ID, plain-text diff | P0 |
| FR-003 | Capture every Slack message post: text, channel ID, channel type, timestamp (`ts`) | P1 |
| FR-004 | Attribute every event to a named agent identifier | P0 |
| FR-005 | Recording MUST NOT block or delay the agent's primary action | P0 |
| FR-006 | Queue events locally in `chrome.storage` if backend is unreachable; flush on reconnect | P0 |
| FR-007 | Assign an idempotency key to every event to prevent duplicate ingestion | P0 |

### 5.2 Timeline & Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-010 | Display chronological, reverse-sorted event feed | P0 |
| FR-011 | Update timeline in real-time (< 2s) without page refresh via Supabase Realtime | P0 |
| FR-012 | Filter by: app (Gmail/Docs/Slack), risk level, date range | P1 |
| FR-013 | Show side-by-side diff for content-changing events | P0 |
| FR-014 | Show event detail: metadata, agent name, risk score, rollback status | P0 |

### 5.3 Rollback

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-020 | One-click rollback from timeline or diff view, with confirmation step | P0 |
| FR-021 | Plain-English description of what will be reversed before confirmation | P0 |
| FR-022 | Gmail rollback: move sent email to trash via Gmail API, < 5s | P0 |
| FR-023 | Google Docs rollback: restore prior revision via Drive Revisions API | P0 |
| FR-024 | Slack rollback: delete message via `chat.delete`; show clear error if outside window | P1 |
| FR-025 | Show real-time rollback status: Queued → In Progress → Success / Failed | P0 |
| FR-026 | Rollback button permanently disabled after successful execution | P0 |

### 5.4 Authentication & Access

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-030 | Google OAuth sign-in via Supabase Auth | P0 |
| FR-031 | Separate explicit authorisation for each connector (Gmail, Docs, Slack) | P0 |
| FR-032 | Users can only access their own event logs (enforced via RLS) | P0 |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | POST /events P95 latency < 200ms |
| Performance | Dashboard initial load < 2s |
| Performance | Rollback execution < 5s |
| Availability | 99.5% uptime target for backend API |
| Security | All data in transit: TLS 1.3 |
| Security | OAuth tokens: AES-256 encrypted at rest |
| Security | Event log: append-only, no UPDATE/DELETE |
| Privacy | No event content accessible to Trailback team without explicit user consent |
| Scalability | Support 500 MAU within Supabase free tier limits |
| Compatibility | Chrome / Chromium 118+ |
| Accessibility | WCAG 2.1 Level AA |

---

## 7. Constraints

- **Zero cost.** Every service used must have a permanent free tier.
- **Solo developer.** Architecture must be operable by one person without DevOps expertise.
- **Student timeline.** MVP must ship within 4–6 weeks.
- **Browser-first.** Chrome extension is the primary sensor; no native desktop agent required.
