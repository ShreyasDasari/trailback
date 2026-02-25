# Flight Recorder
## Product Requirements Document (PRD)
**Version:** 1.0
**Status:** Approved for MVP Development
**Last Updated:** February 2026
**Product Owner:** Flight Recorder Product Team
**Target Launch:** Q2 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Market Opportunity](#3-market-opportunity)
4. [Target Users & Personas](#4-target-users--personas)
5. [Product Vision & Strategy](#5-product-vision--strategy)
6. [Competitive Landscape](#6-competitive-landscape)
7. [Product Requirements](#7-product-requirements)
8. [User Stories](#8-user-stories)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Out of Scope](#11-out-of-scope)
12. [Success Metrics & KPIs](#12-success-metrics--kpis)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Go-to-Market Strategy](#14-go-to-market-strategy)
15. [Roadmap](#15-roadmap)

---

## 1. Executive Summary

Flight Recorder is a cross-application **agent action recorder and rollback layer** that gives users full visibility and recoverability over every action an AI agent takes on their behalf. As AI agents begin operating across Gmail, Google Docs, Slack, and other productivity tools — sending emails, editing documents, posting messages, modifying settings — the single biggest barrier to enterprise and SMB adoption is not capability, but **trust**.

Users are asking two questions: *"What exactly did it do?"* and *"Can I undo it if it goes wrong?"* Flight Recorder answers both definitively.

The product ships as a **Chrome browser extension** (the recorder) + a **web dashboard** (the timeline, diff viewer, and rollback console). It is app-agnostic at the surface — it doesn't care what AI agent the user is running — and it provides a universal undo stack for the agentic web.

**Tagline:** *"Every agent action, recorded and reversible."*

---

## 2. Problem Statement

### The Inflection Point

Agentic AI execution is accelerating rapidly. Tools like Claude, ChatGPT, Gemini, and custom enterprise agents are increasingly taking **real, irreversible actions** in the world: sending emails on a user's behalf, editing shared documents, updating CRM records, posting to Slack channels. Unlike a chat response — which a user simply reads — these actions have side effects that persist after the conversation ends.

### The Trust Gap

Despite this capability, enterprise and SMB adoption of AI agents for real actions remains low. In user research and market feedback across the industry, three fears dominate:

1. **"What did it do?"** — There is no unified, human-readable audit trail of agent actions across apps. Users are left piecing together activity logs from Gmail's Sent folder, Google Docs' revision history, and Slack's message feed — none of which are designed with AI accountability in mind.

2. **"What if it does something wrong?"** — Users know they can't fully predict what an agent will do in every edge case. Without a rollback mechanism, the risk of granting an agent write access is too high.

3. **"How do I explain this to my team?"** — In team environments, ops leads and compliance officers need a blame-free, shareable audit trail. Today, there is none.

### The Gap in the Market

Existing solutions are either too narrow (Gmail's Sent folder shows emails, but not intent), too complex (enterprise SIEM tools require months of setup), or non-existent for the browser/agent context. No product today offers a universal, one-click flight recorder for AI agent actions across the productivity tools people actually use.

---

## 3. Market Opportunity

### Why Now (2026)

The convergence of three trends makes 2026 the precise moment to build this:

- **Agentic execution is mainstream.** Claude, GPT-4o, and Gemini can now take real actions via browser extensions, desktop apps, and API integrations. The question is no longer *"can agents do this?"* but *"can we trust agents to do this?"*
- **Compliance pressure is rising.** The EU AI Act (effective August 2025) requires logging for high-risk AI systems. NIST AI RMF is being adopted by US enterprises. Security-conscious SMBs are asking for audit trails before deploying agents.
- **No incumbent owns this.** Datadog and Langfuse solve server-side LLM observability. No one solves **end-user, cross-app, browser-level agent observability with rollback**.

### TAM / SAM / SOM

| Market | Estimate | Rationale |
|--------|---------|-----------|
| **TAM** | $4.2B | Global market for AI governance, audit, and observability tools (2026 est.) |
| **SAM** | $620M | SMBs + compliance-heavy startups using AI agents in productivity workflows |
| **SOM** | $6.2M | 5,000 paying teams at $25–$100/mo in first 24 months post-launch |

### Target Verticals (ICP)

- **Security-conscious SMBs** using AI assistants for sales outreach and ops automation
- **Legal and financial startups** where every communication must be auditable
- **Ops and RevOps teams** running agents on CRM and email workflows
- **AI-forward product teams** that want to give non-technical teammates confidence to delegate to agents

---

## 4. Target Users & Personas

### Persona 1 — Alex, the Ops Lead (Primary)
**Title:** Operations Manager, 80-person SaaS startup
**Age:** 32 | **Technical level:** Medium
**Context:** Alex's team started using Claude to draft and send follow-up emails and update Notion docs. Two weeks in, a misconfigured agent sent a mass email to 200 contacts with the wrong pricing. Alex spent 3 hours trying to trace what happened across Gmail logs and Notion history.
**Core need:** "I need to know exactly what the agent did and be able to undo it without calling in an engineer."
**Willingness to pay:** $49/mo for the team plan without hesitation.

### Persona 2 — Priya, the Security-Conscious Founder (Buyer)
**Title:** Co-founder & CTO, 15-person fintech startup
**Age:** 29 | **Technical level:** High
**Context:** Priya's company handles financial data. She wants to use AI agents for internal reporting but her compliance advisor told her she needs an audit trail before they can go live.
**Core need:** "Show me an export of every action the agent has taken, with timestamps, for our SOC 2 audit."
**Willingness to pay:** $99/mo for the compliance plan.

### Persona 3 — Marcus, the Power User (Champion)
**Title:** Senior Product Manager, 300-person software company
**Age:** 35 | **Technical level:** High
**Context:** Marcus runs AI agents daily for research, doc editing, and Slack summaries. He's comfortable with the technology but wants a "safety net" — a way to catch the 1-in-50 actions that go subtly wrong.
**Core need:** "I want to see a timeline of everything the agent did today and be able to undo anything with one click."
**Willingness to pay:** $12/mo personal plan.

---

## 5. Product Vision & Strategy

### Vision
To become the **universal trust layer for AI agents** — the product that sits between every AI agent and every app it operates on, making agentic execution safe, auditable, and reversible for individuals and teams.

### Strategic Positioning
Flight Recorder is positioned as **"productivity insurance"**, not a compliance tool. The framing is proactive and empowering — it's about giving users the confidence to delegate more to AI agents, not about catching agents doing bad things. The compliance and audit angles are secondary benefits that unlock enterprise deals.

### Moat
The competitive moat deepens over time across three dimensions:

1. **Depth of integration.** Each connector (Gmail, Docs, Slack) requires non-trivial engineering to intercept, snapshot, diff, and roll back correctly. Building all three creates a lead that takes competitors 6–12 months to replicate.
2. **Universal diff/rollback abstraction.** The internal abstraction for "what does rollback mean for this action type on this app" is genuinely hard. It's not just an API call — it's domain-specific knowledge baked into connectors.
3. **Trust reputation data.** Over time, Flight Recorder will accumulate data on which agents behave reliably and which don't — creating a "trust score" that competitors without this dataset cannot replicate.

---

## 6. Competitive Landscape

| Product | Category | What They Do | Gap vs. Flight Recorder |
|---------|----------|-------------|------------------------|
| **Langfuse** | LLM Observability | Traces LLM calls server-side (token usage, latency) | No browser-level interception, no rollback, developer-facing only |
| **Arize AI** | ML Monitoring | Monitors ML model performance in production | Enterprise/ML-team focused, no productivity app integration |
| **Gmail Sent Folder** | Native Log | Shows sent emails | No agent context, no diff, no one-click rollback |
| **Google Docs Revision History** | Native Log | Shows document edit history | Not cross-app, no agent attribution, no one-click restore |
| **Datadog** | Infra Observability | Logs and traces server infrastructure | Requires engineering setup, no end-user agent focus |
| **Notion Activity Log** | Native Log | Shows page edits | Single app, no rollback |

**Flight Recorder's Unique Position:** The only product that (1) operates at browser level, (2) works across multiple apps, (3) attributes actions to specific AI agents, and (4) provides one-click rollback through a non-technical UI.

---

## 7. Product Requirements

### 7.1 Core Recording Requirements

**FR-001 — Gmail Send Capture**
The system MUST capture the full content of every email sent via an AI agent on Gmail, including: recipient addresses, subject line, email body (plain text and HTML), thread ID, and message ID.

**FR-002 — Google Docs Edit Capture**
The system MUST capture before and after snapshots for every Google Document edit triggered by an AI agent, along with the Drive revision ID that enables restoration.

**FR-003 — Slack Message Capture**
The system MUST capture every Slack message posted by an AI agent, including: message text, channel ID, channel type (public/private/DM), and the message timestamp (`ts`) required for deletion.

**FR-004 — Event Attribution**
Every captured event MUST be attributed to a specific agent identifier (e.g., "claude-desktop", "custom-agent-1") so users can filter the timeline by agent.

**FR-005 — Non-Blocking Recording**
The recording mechanism MUST NOT block, delay, or alter the agent's primary action. If the recorder fails, the action must still proceed.

**FR-006 — Offline Event Queue**
The Chrome extension MUST queue events locally (in `chrome.storage`) if the backend is unreachable, and flush the queue automatically when connectivity is restored.

### 7.2 Timeline & Dashboard Requirements

**FR-010 — Timeline View**
The dashboard MUST display a chronological, reverse-sorted feed of all captured events. Each event card MUST show: app icon, action type in plain English, timestamp, agent name, and risk badge.

**FR-011 — Real-time Updates**
The timeline MUST update in real-time (within 2 seconds) when a new event is captured, without requiring a page refresh.

**FR-012 — Filtering**
Users MUST be able to filter the timeline by: app (Gmail / Docs / Slack), risk level (LOW / MEDIUM / HIGH / CRITICAL), and date range.

**FR-013 — Diff View**
For every event that involves a content change (doc edit, email body), the system MUST provide a side-by-side diff view showing exact before and after states, with additions highlighted in green and removals in red.

**FR-014 — Event Detail**
Each event MUST have a detail page showing: full metadata, agent intent (if logged), risk score and reasons, snapshot comparison, and rollback status.

### 7.3 Rollback Requirements

**FR-020 — One-Click Rollback**
Users MUST be able to initiate a rollback for any eligible event from the timeline or diff view with a single click, followed by a confirmation step.

**FR-021 — Rollback Confirmation**
Before executing a rollback, the system MUST display a plain-English description of what will be reversed (e.g., "This will move your email to John Smith to Gmail Trash.") and require explicit confirmation.

**FR-022 — Gmail Rollback**
The system MUST be able to move a sent Gmail email to trash via the Gmail API. The rollback MUST complete within 5 seconds of confirmation.

**FR-023 — Google Docs Rollback**
The system MUST be able to restore a Google Document to its pre-edit revision using the Drive Revisions API.

**FR-024 — Slack Rollback**
The system MUST attempt to delete a Slack message using the `chat.delete` API. If the message is outside the deletion window or if the user lacks admin permissions, the system MUST display a clear, non-blocking error explaining why rollback is unavailable.

**FR-025 — Rollback Status**
After initiating a rollback, the UI MUST display real-time status: Queued → In Progress → Success or Failed. On failure, the reason MUST be shown in plain English.

**FR-026 — Rollback Immutability**
A successfully executed rollback MUST NOT be re-rollable. The event's `rollback_status` MUST update to "executed" and the rollback button MUST become permanently disabled.

### 7.4 Authentication & Access Requirements

**FR-030 — Google OAuth Sign-In**
Users MUST be able to sign in using their Google account via Supabase OAuth.

**FR-031 — Connector Authorization**
Users MUST explicitly authorize each connector (Gmail, Docs, Slack) separately, with clear disclosure of what OAuth scopes are being requested and why.

**FR-032 — Data Isolation**
Users MUST only ever be able to see their own event logs. Cross-user data access MUST be impossible at the database level (enforced via Row Level Security).

---

## 8. User Stories

### Epic 1: Recording

| Story ID | As a... | I want to... | So that... |
|----------|---------|-------------|-----------|
| US-001 | Power user | See every email my AI agent has sent | I know exactly what went out on my behalf |
| US-002 | Power user | See what changes an agent made to my Google Docs | I can understand and verify every edit |
| US-003 | Ops manager | Attribute each action to a specific agent | I can understand which agent caused which outcome |
| US-004 | Any user | Trust that the extension never slows down my Gmail | My primary workflow is never degraded |

### Epic 2: Dashboard & Visibility

| Story ID | As a... | I want to... | So that... |
|----------|---------|-------------|-----------|
| US-010 | Any user | See a real-time timeline of agent actions | I always know what's happening right now |
| US-011 | Ops manager | Filter the timeline by risk level | I can quickly triage high-risk actions |
| US-012 | Any user | See a before/after diff for any document edit | I can understand exactly what changed and how |
| US-013 | Compliance officer | See a complete, tamper-proof action log | I can use it in an audit |

### Epic 3: Rollback

| Story ID | As a... | I want to... | So that... |
|----------|---------|-------------|-----------|
| US-020 | Power user | Undo a Gmail send with one click | I can recover from a mistake quickly |
| US-021 | Ops manager | Restore a Google Doc to before an agent edited it | I can reverse an unwanted change without finding the right revision manually |
| US-022 | Any user | Know whether a rollback is possible before I try | I don't waste time attempting an impossible rollback |
| US-023 | Any user | See why a rollback failed if it doesn't work | I can take manual corrective action |

---

## 9. Acceptance Criteria

### AC-001: Gmail Email Capture
- **Given** an AI agent sends an email via Gmail
- **When** the Chrome extension is active on `mail.google.com`
- **Then** the event appears in the Flight Recorder timeline within 2 seconds
- **And** the event contains the correct recipient(s), subject, and a snapshot of the email body
- **And** the event's risk level is correctly classified

### AC-002: Google Docs Edit Capture
- **Given** an AI agent triggers an auto-save on a Google Document
- **When** the Chrome extension is active on `docs.google.com`
- **Then** the event appears in the timeline within 5 seconds (docs auto-save may be batched)
- **And** the before revision ID and after revision ID are correctly stored
- **And** the diff view shows an accurate character-level diff

### AC-003: Gmail Rollback Success
- **Given** a Gmail send event exists with `rollback_status = "available"`
- **When** the user clicks Rollback and confirms
- **Then** the email is moved to Gmail Trash within 5 seconds
- **And** the event's `rollback_status` updates to `"executed"`
- **And** the timeline and event detail page reflect the updated status
- **And** the Rollback button becomes permanently disabled

### AC-004: Risk Classification
- **Given** an email is sent to more than 10 recipients
- **When** the event is ingested by the backend
- **Then** the `risk_level` is set to `"critical"`
- **And** the risk badge in the timeline shows a red CRITICAL indicator

### AC-005: Real-time Dashboard Update
- **Given** a user has the timeline dashboard open
- **When** an AI agent takes an action captured by the extension
- **Then** the new event card appears at the top of the timeline within 2 seconds
- **And** no page refresh is required

---

## 10. Non-Functional Requirements

| Category | Requirement |
|---------|------------|
| **Performance** | Event ingestion endpoint P95 latency < 200ms |
| **Performance** | Dashboard initial load < 2 seconds on a standard connection |
| **Performance** | Rollback execution < 5 seconds for Gmail and Slack |
| **Availability** | Target 99.5% uptime for backend API (Render free tier; upgrade at revenue) |
| **Security** | All data in transit encrypted via TLS 1.3 |
| **Security** | OAuth tokens encrypted at rest (AES-256 via Supabase Vault) |
| **Security** | Event logs append-only: no UPDATE or DELETE permissions on events table for app user |
| **Privacy** | No event log content accessible to Flight Recorder employees without user consent |
| **Scalability** | MVP target: support up to 500 active users within free tier limits |
| **Compatibility** | Chrome / Chromium 118+ (MV3 compatible) |
| **Accessibility** | Dashboard WCAG 2.1 Level AA compliant |
| **Reliability** | Extension event queue ensures zero event loss during backend downtime |

---

## 11. Out of Scope

The following are explicitly deferred and will not be built during the MVP phase:

- Multi-user team workspaces and shared audit trails
- Automated rollback policies (trigger rollback automatically above a risk threshold)
- LLM-powered action summarization or anomaly detection
- Notion, Jira, HubSpot, Salesforce, or GitHub connectors
- Firefox or Safari browser extension support
- Mobile browser support
- Stripe billing integration and paid plan enforcement
- Role-based access control (admin, viewer, editor roles)
- Webhook support for external alerting (PagerDuty, etc.)
- API access for programmatic event querying (developer API)
- SOC 2 certification (targeted for post-Series A)

---

## 12. Success Metrics & KPIs

### North Star Metric
**Weekly Active Recorders (WAR):** Number of unique users whose extension captures at least one event per week. This reflects genuine product-market fit — people are using AI agents, trust Flight Recorder to record them, and keep it installed.

### Activation Metrics (Week 1)

| Metric | Target |
|--------|--------|
| Time from install to first event captured | < 10 minutes |
| % of users who capture their first event within 24 hours of install | > 70% |
| % of users who successfully connect at least 2 apps | > 50% |

### Engagement Metrics (Month 1)

| Metric | Target |
|--------|--------|
| Weekly Active Recorders (WAR) | 200 users |
| Average events captured per active user per week | > 10 |
| % of users who use Diff View at least once | > 60% |
| % of users who execute at least one rollback | > 25% |

### Retention Metrics

| Metric | Target |
|--------|--------|
| Day-7 retention | > 45% |
| Day-30 retention | > 30% |
| Extension uninstall rate in first 30 days | < 20% |

### Business Metrics (Month 6)

| Metric | Target |
|--------|--------|
| Monthly Active Users | 1,000 |
| Paying users (converted to Pro/Team) | 50 |
| Monthly Recurring Revenue (MRR) | $1,500 |
| Net Promoter Score (NPS) | > 45 |

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Google changes Gmail API and breaks interception | Medium | High | Maintain fallback DOM-based interception alongside API interception |
| Slack removes `chat.delete` from standard scopes | Low | Medium | Document the limitation clearly; pursue Slack admin channel or bot token |
| Google blocks Chrome extensions from intercepting `googleapis.com` calls | Low | Critical | Monitor Chrome MV3 changes closely; explore Google Workspace Add-on as backup |
| Users perceive the extension as surveillance/spyware | Medium | High | Transparent privacy policy, explicit consent UI, open-source extension code |
| Rollback creates worse state than the original mistake | Medium | Medium | Require confirmation with explicit description; log rollback events for auditability |
| Render backend spins down, causing event loss | High (free tier) | Medium | Local extension queue absorbs events; flush on reconnect |
| Low AI agent adoption slows product usage | Low | High | Validate by targeting early adopters already using Claude/GPT for real actions |

---

## 14. Go-to-Market Strategy

### Phase 1 — Seed Users (Launch Month)
**Channel:** Hacker News "Show HN" post + Product Hunt launch
**Message:** "We built a Flight Recorder for AI agents — it logs every action and lets you roll back with one click"
**Goal:** 500 installs, 100 active users, 10 qualitative interviews

### Phase 2 — Community Distribution (Month 2–3)
**Channels:** AI/automation communities (r/MachineLearning, Latent Space Discord, Every.to AI audience), cold outreach to ops leads at AI-forward SMBs
**Message:** Frame as "productivity insurance": "You wouldn't drive without insurance. Why run AI agents without a flight recorder?"
**Goal:** 50 paying teams

### Phase 3 — Content SEO (Month 3–6)
**Strategy:** Publish "AI Agent Safety" content — guides on responsible agent deployment, rollback best practices, compliance checklists for AI-first teams
**Goal:** Organic inbound from compliance and ops searches; 200 paying teams

### Pricing (Post-MVP)

| Plan | Price | Limits |
|------|-------|--------|
| **Free** | $0/mo | 1 user, 7-day log retention, 3 app connectors, 50 events/day |
| **Pro** | $12/mo | 1 user, unlimited retention, 5 connectors, unlimited events |
| **Team** | $49/mo | 5 users, unlimited retention, all connectors, shared audit trail, CSV export |
| **Compliance** | $99/mo | 10 users, unlimited retention, all connectors, SOC 2 export, API access |

---

## 15. Roadmap

### MVP (Now — 6 Weeks)
Core recording (Gmail, Docs, Slack) + Timeline + Diff View + Rollback (Gmail, Docs, Slack) + Chrome Extension + Dashboard

### v1.1 (Month 2–3)
- Notion connector (read + rollback doc edits)
- Team accounts (shared timeline, 3 users)
- CSV / PDF audit trail export
- 30-day log retention on free tier → 7 days (enforce retention tiers)

### v1.2 (Month 4–5)
- Jira connector (log and rollback issue updates)
- Google Calendar connector (log and rollback event creation/deletion)
- Automated risk alerts (email/Slack notification on CRITICAL events)
- Agent trust score dashboard

### v2.0 (Month 6–9)
- LLM-powered action summaries (Gemini Flash, async, optional)
- Rollback policies (auto-rollback above configurable risk threshold)
- Developer API (programmatic event querying for enterprise integrations)
- Firefox extension support

### v3.0 (Month 12+)
- Desktop agent integration (capture actions from non-browser agents)
- SOC 2 Type 2 certification
- SSO / SAML for enterprise deals
- SCIM provisioning
