<table border="0" cellpadding="0" cellspacing="0">
<tr>
<td><img src="trailback-logo.svg" width="72" height="72" alt="Trailback logo"/></td>
<td>&nbsp;&nbsp;&nbsp;</td>
<td><h1>Trailback</h1></td>
</tr>
</table>

**The trust, audit, and recovery layer for production AI agents. Intercept every action, understand every change, reverse anything.**

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/ShreyasDasari/trailback)
[![Python](https://img.shields.io/badge/python-3.12-blue)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Live](https://img.shields.io/badge/live-trailback.vercel.app-6ee7b7)](https://trailback-qkgwckod8-shreyasdasaris-projects.vercel.app)

```
TRAILBACK - LIVE EVENT FEED
════════════════════════════════════════════════════════
Agent              App      Action           Risk      Status
════════════════════════════════════════════════════════
claude-desktop     gmail    email.send       MEDIUM    available
claude-desktop     gdocs    doc.edit         HIGH      available
claude-desktop     slack    message.post     LOW       available
claude-desktop     gmail    email.send       CRITICAL  rolled back

ROLLBACK EXECUTED in 1.2s
  gmail -> messages.trash(19ca77a2c64e1117)
  Before: "Sent to shreyasdasari@gmail.com | Subject: Q4 Update"
  After:  Moved to Trash
════════════════════════════════════════════════════════
```

---

## Why Trailback

| | Trailback | LangSmith | Helicone | Manual Logs |
|---|---|---|---|---|
| **Records real-world actions** | Yes (Gmail, Docs, Slack) | No - LLM calls only | No - LLM calls only | No |
| **Before/after diff** | Yes | No | No | No |
| **One-click rollback** | Yes | No | No | No |
| **Risk scoring** | Yes (7 rule groups, < 5ms) | No | No | No |
| **Real-time dashboard** | Yes (Supabase Realtime) | Partial | No | No |
| **Chrome extension sensor** | Yes | No | No | No |
| **Audit CSV export** | Yes | No | Partial | No |
| **Setup time** | 5 minutes | 30 minutes | 30 minutes | Hours |
| **Target user** | Teams deploying AI agents | LLM developers | LLM developers | Everyone |

---

## The Problem

AI agents are moving from demos to production. They are sending emails, editing documents, posting messages, and making decisions autonomously, at speed, across your most important tools.

The primary blockers to trusting them in production are:

**No unified audit trail.** There is no cross-app, human-readable record of what an agent did, when, and why. LangSmith and Helicone trace LLM calls. Nobody traces the real-world actions those calls produce.

**No recoverability.** Once an agent sends an email or edits a document, undoing it is manual, time-consuming, and often impossible without direct API knowledge.

**No trust signal.** Teams cannot delegate real work to agents without a safety net. The moment one agent does something wrong, confidence in the entire workflow collapses.

Trailback solves all three. It is the flight recorder and recovery layer that sits between your AI agents and the real world.

---

## Quick Start

**Step 1:** Install the Chrome extension.

Load `apps/extension` as an unpacked extension in Chrome. The extension silently monitors your agent's API calls with no configuration required.

**Step 2:** Sign in to the dashboard.

```
https://trailback-qkgwckod8-shreyasdasaris-projects.vercel.app
```

Sign in with Google. Your events will appear in the timeline the moment your agent takes an action.

**Step 3:** Run the backend locally (optional, production backend is already live).

```bash
git clone https://github.com/ShreyasDasari/trailback
cd trailback/apps/backend
pip install -r requirements.txt
cp .env.example .env   # add your Supabase credentials
uvicorn main:app --reload
```

The backend is already deployed at `https://trailback-gby8.onrender.com`. You only need to run it locally for development.

---

## How It Works

### 1. The Chrome Extension Intercepts

The extension runs a content script in the MAIN world of Gmail, Google Docs, and Slack. It hooks into `window.fetch` before your agent's API calls reach the network, captures the before and after state, and passes the event to the service worker without blocking the original request.

Every event gets a UUID idempotency key. If the backend is unreachable, events queue in `chrome.storage.local` and flush automatically when the connection returns.

### 2. The Backend Scores and Stores

The FastAPI backend receives each event and runs it through the risk classifier in under 5ms. The classifier applies seven rule groups (action type, recipient breadth, external domains, document change magnitude, Slack channel type, business hours, and agent trust score) and produces a risk level with plain-English reasons.

The event is then written to Supabase with a before snapshot, an after snapshot, and a SHA-256 content hash for integrity verification. Row Level Security ensures users can only ever see their own events.

### 3. The Dashboard Displays in Real-Time

The Next.js dashboard subscribes to the `events` table via Supabase Realtime. New events appear in the timeline feed without a page refresh, color-coded by risk level. Every event card shows the app, action, agent name, risk badge, time ago, and a rollback button.

### 4. One-Click Rollback

Clicking Rollback shows a plain-English description of exactly what will be reversed. No technical error codes, no raw JSON. After confirmation, the backend calls the appropriate connector:

- **Gmail:** `messages.trash(message_id)` via Gmail API. Email moved to Trash in under 5 seconds.
- **Google Docs:** `revisions.update` via Drive API. Document restored to the prior revision.
- **Slack:** `chat.delete(channel, ts)` via Slack Web API. Message deleted, with a clear error message if outside the deletion window.

The rollback status updates in real-time: Queued -> In Progress -> Success / Failed.

---

## Architecture

```
Chrome Extension (MV3)
  ├── gmail-interceptor.js      # Hooks window.fetch in Gmail
  ├── docs-interceptor.js       # Detects Drive auto-save API calls
  ├── slack-interceptor.js      # Hooks Slack chat.postMessage
  └── service-worker.js         # Queue + 30s flush to backend

FastAPI Backend (Render)
  ├── POST /api/v1/events             # Ingest + risk score + store
  ├── GET  /api/v1/timeline           # Paginated event feed
  ├── GET  /api/v1/events/:id/diff    # Before/after snapshots
  ├── POST /api/v1/rollback/:id       # Execute rollback
  ├── GET  /api/v1/rollback/:id/status # Poll rollback result
  ├── GET  /api/v1/connectors         # List connected apps
  ├── GET  /api/v1/agents             # Agent registry
  └── GET  /api/v1/audit              # CSV export

Supabase (PostgreSQL)
  ├── events          # Append-only action log
  ├── snapshots       # Before/after content per event
  ├── rollbacks       # Full rollback history
  ├── connectors      # OAuth tokens per user per app
  └── agents          # Trust score tracking

Next.js Dashboard (Vercel)
  ├── /                    # Landing page
  ├── /login               # Google OAuth
  ├── /timeline            # Real-time event feed
  ├── /event/:id/diff      # Before/after diff view
  ├── /event/:id/rollback  # Two-step rollback confirmation
  ├── /settings/connectors # Connect/disconnect apps
  └── /settings/agents     # Agent registry + trust scores
```

---

## Risk Scoring

Every event is scored synchronously in under 5ms using a deterministic rule engine. No LLM, no external calls, no added latency.

### The 7 Rule Groups

**Rule 1 - Action type base score**

Every action type carries a base risk score based on its potential blast radius.

| Action | Base Score |
|--------|-----------|
| `email.send` | 10 |
| `email.send_bulk` | 40 |
| `doc.delete` | 30 |
| `file.delete` | 35 |
| `doc.share` | 20 |
| `message.post_public` | 20 |
| `doc.edit` | 8 |
| `message.post` | 8 |

**Rule 2 - Recipient breadth (Gmail)**

Emails sent to 5+ recipients add 15 points. 10+ adds 25. 20+ adds 35 with a "mass send" label.

**Rule 3 - External domain check (Gmail)**

Recipients whose domain differs from the sender's domain add 15 points. Internal-only sends are not penalised.

**Rule 4 - Document change magnitude (Docs)**

Change delta under 1,000 characters: no penalty. 1,000-5,000: +10. 5,000-10,000: +20. Over 10,000: +30 with a "very large change" label.

**Rule 5 - Slack channel type**

Public channels add 20 points. Private channels add 5.

**Rule 6 - Timing**

Actions taken outside 08:00-20:00 UTC add 5 points. Weekend actions add 8 points.

**Rule 7 - Agent trust score**

Agents with a trust score below 0.7 have their total score multiplied by 1.3. Below 0.9: multiplied by 1.15. Trust score is recomputed after every rollback: `trust_score = 1 - (rolled_back / total_actions)`.

### Risk Levels

| Score | Level | Badge |
|-------|-------|-------|
| 0-19 | Low | Gray |
| 20-39 | Medium | Amber |
| 40-69 | High | Orange |
| 70-100 | Critical | Red (pulsing) |

---

## API Reference

All endpoints require `Authorization: Bearer <supabase_jwt>` except `/health`.

### Events

```
POST /api/v1/events
```

Ingest an agent action. Runs risk classification, stores event and snapshots, returns risk result.

```json
{
  "app": "gmail",
  "action_type": "email.send",
  "agent_id": "claude-desktop-v1",
  "metadata": {
    "to": ["john@acme.com"],
    "subject": "Q4 Update",
    "message_id": "19ca77a2c64e1117"
  },
  "before_snapshot": { "content": "Draft body text", "content_type": "text/plain" },
  "after_snapshot": { "message_id": "19ca77a2c64e1117", "sent_at": "2026-03-16T14:30:00Z" }
}
```

```
GET /api/v1/timeline?limit=20&offset=0&app=gmail&risk_level=high&from=2026-03-01&to=2026-03-16
GET /api/v1/events/:id
GET /api/v1/events/:id/diff
```

### Rollback

```
POST /api/v1/rollback/:event_id
```

```json
{ "confirmation": true, "reason": "Agent sent to wrong recipient" }
```

Returns `202 Accepted` with a `rollback_id`. Poll for result:

```
GET /api/v1/rollback/:rollback_id/status
```

Returns `result: "pending" | "success" | "failed"` with `failure_reason` and `executed_at`.

### Other endpoints

```
GET    /api/v1/connectors
DELETE /api/v1/connectors/:app
GET    /api/v1/agents
POST   /api/v1/agents          { "name": "My Agent" }
GET    /api/v1/audit?from=2026-03-01&to=2026-03-16   -> text/csv
GET    /api/v1/health
```

---

## Database Schema

Five tables in Supabase PostgreSQL. Row Level Security enabled on all tables. OAuth tokens encrypted at rest via Supabase Vault.

| Table | Purpose |
|-------|---------|
| `events` | Append-only action log. No UPDATE or DELETE by application users. |
| `snapshots` | Before and after content per event. SHA-256 hash for integrity. |
| `rollbacks` | Full history of every rollback attempt with result and API response. |
| `connectors` | OAuth connection state per user per app. Token never returned to frontend. |
| `agents` | Registered agents with trust score, action count, rollback count. |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Extension | Chrome MV3, Vanilla JS | Action interception and event queuing |
| Backend | FastAPI, Python 3.12 | API, risk scoring, rollback execution |
| Database | Supabase (PostgreSQL 15) | Event storage, auth, realtime, RLS |
| Frontend | Next.js 15, Tailwind, shadcn/ui | Dashboard and landing page |
| Auth | Supabase Auth + Google OAuth | User authentication |
| Deployment | Render (backend), Vercel (frontend) | Production hosting |
| HTTP client | httpx | Async connector calls to Google and Slack APIs |
| Testing | pytest | 31 unit and integration tests |

---

## Project Structure

```
trailback/
├── apps/
│   ├── backend/
│   │   ├── main.py                 # All API endpoints
│   │   ├── api/deps.py             # JWT auth middleware
│   │   ├── core/risk_classifier.py # 7-rule risk engine
│   │   ├── connectors/
│   │   │   ├── gmail.py            # Gmail trash connector
│   │   │   ├── gdocs.py            # Drive revision restore
│   │   │   └── slack.py            # Slack message delete
│   │   ├── models/event.py         # Pydantic schemas
│   │   ├── db/supabase_client.py   # Supabase client
│   │   ├── tests/
│   │   │   ├── unit/               # Classifier + connector tests
│   │   │   └── integration/        # API endpoint tests
│   │   └── requirements.txt
│   ├── extension/
│   │   ├── manifest.json
│   │   ├── background/service-worker.js
│   │   ├── content-scripts/
│   │   │   ├── gmail-interceptor.js
│   │   │   ├── docs-interceptor.js
│   │   │   └── slack-interceptor.js
│   │   └── popup/popup.html
│   └── web/                        # Next.js dashboard
│       ├── app/
│       │   ├── page.tsx            # Landing page
│       │   ├── (auth)/login/
│       │   ├── (dashboard)/timeline/
│       │   ├── event/[id]/diff/
│       │   ├── event/[id]/rollback/
│       │   └── settings/
│       ├── components/
│       │   ├── EventCard.tsx
│       │   ├── RiskBadge.tsx
│       │   ├── AppIcon.tsx
│       │   └── FilterBar.tsx
│       └── lib/supabase/
└── docs/                           # Architecture and spec docs
```

---

## Performance

| Metric | Target | Current |
|--------|--------|---------|
| Risk classification | < 5ms | ~1-2ms |
| `POST /events` P95 latency | < 200ms | ~80ms |
| Gmail rollback execution | < 5s | ~1-2s |
| Dashboard initial load | < 2s | ~1.2s |
| Realtime event delivery | < 2s | ~500ms |
| Extension capture overhead | < 50ms | < 10ms |

---

## Security

- All API traffic over TLS 1.3
- JWT validated on every request via Supabase public key
- OAuth tokens encrypted at rest, never returned to the frontend
- Event log is append-only, no UPDATE or DELETE at the application level
- Row Level Security enforced at the database layer, users cannot access other users' data
- Idempotency keys prevent duplicate event ingestion
- Content hashed with SHA-256 for integrity verification

---

## Roadmap

### v1.1 - Team features
- Shared timeline for up to 3 users
- Notion connector (read + rollback doc edits)
- CSV / PDF audit export with branding
- 30-day log retention on free tier

### v1.2 - Alerts and calendar
- Jira connector
- Google Calendar connector
- Automated risk alerts via email or Slack on CRITICAL events
- Agent trust score history chart

### v2.0 - Intelligence layer
- LLM-powered action summaries (Gemini Flash, async, optional)
- Automated rollback policies (auto-rollback above configurable threshold)
- Developer API for programmatic event querying
- Firefox extension support

### v3.0 - Enterprise
- SOC 2 Type 2 certification
- SSO / SAML
- SCIM provisioning
- Desktop agent integration (non-browser agents)
- OpenTelemetry-native ingestion

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/notion-connector`
3. Backend: follow the connector pattern in `apps/backend/connectors/gmail.py`. Return `{"success": True, ...}` or `{"success": False, "error": "..."}` and add unit tests.
4. Extension: follow the interceptor pattern in `content-scripts/gmail-interceptor.js`
5. All functions must have docstrings and single responsibility (max 40 lines)
6. Open a pull request describing the connector, which app it targets, and what rollback means for that app

Bug reports and feature requests welcome via GitHub Issues.

---

## FAQ

**Does Trailback slow down my agent?**

No. The extension hooks into `window.fetch` and passes the event to the service worker asynchronously. The original API call is never blocked or delayed. Capture overhead is under 10ms.

**What happens if the backend is down?**

Events queue in `chrome.storage.local` and flush automatically when the connection returns. No events are lost.

**Can Trailback read my email content?**

The before snapshot captures the draft body at interception time. This content is stored in your own Supabase project. Trailback never has access to your data. You own the database.

**Is rollback always possible?**

Not always. Gmail rollback works within the Gmail API's constraints. Slack message deletion has a time window depending on your workspace settings. Google Docs revision restore depends on the revision being available in Drive history. Trailback shows a clear, plain-English error when rollback is not possible rather than silently failing.

**Does it work with any AI agent?**

Any agent that operates through a browser and uses Gmail, Google Docs, or Slack will be captured automatically. Claude, GPT-4, Gemini, Cursor, or a custom agent. No SDK integration required.

**What if I have multiple agents?**

Register each agent in `/settings/agents`. Each gets a unique `agent_key`. Trailback tracks actions and trust score per agent so you can see which agents are reliable and which ones need watching.

---

## License

MIT License - Copyright (c) 2026 Shreyas Dasari

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Acknowledgements

- [Supabase](https://supabase.com) for the database, auth, and realtime infrastructure that let a 4-person team ship this in 4 weeks
- [Render](https://render.com) for zero-config Python deployment with a generous free tier
- [Vercel](https://vercel.com) for instant Next.js deployments and preview URLs on every branch
- [shadcn/ui](https://ui.shadcn.com) for the component library that made the dashboard look production-grade from day one