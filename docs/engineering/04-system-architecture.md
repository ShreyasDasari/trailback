# 04 — System Architecture
**Project:** Trailback
**Version:** 1.0
**Last Updated:** February 2026

---

## 1. Architectural Principles

| Principle | Application |
|-----------|-------------|
| **Determinism over AI** | Interception, diff, and rollback are fully rule-based. No LLM in the critical path. |
| **Append-only immutability** | Events are never updated or deleted. Rollbacks create compensating events. |
| **Fail-open recording** | If the recorder fails, the agent's action still proceeds. Observability never blocks. |
| **Edge-first interception** | The Chrome extension intercepts at the browser edge — no proxy, no DNS changes. |
| **Separation of concerns** | Extension / Backend / Database / Frontend are independently deployable and replaceable. |

---

## 2. System Context

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                            │
│                                                                  │
│   ┌────────────────┐     ┌──────────────────────────────────┐   │
│   │  AI Agent Tab  │────▶│  Trailback Chrome Extension MV3  │   │
│   │ (Claude / GPT) │     │  - Content scripts               │   │
│   └────────────────┘     │  - Fetch interceptor             │   │
│                          │  - Service worker + event queue  │   │
│   ┌────────────────┐ ◀── │  - Popup UI                      │   │
│   │ Gmail/Docs/    │     └──────────────┬───────────────────┘   │
│   │ Slack Tab      │                    │ HTTPS POST /events     │
│   └────────────────┘                    │                        │
└────────────────────────────────────────┼───────────────────────┘
                                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BACKEND (Render — FastAPI)                   │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Event API  │  │ Rollback API │  │     Query API          │ │
│  │  /events    │  │ /rollback    │  │  /timeline /diff       │ │
│  └──────┬──────┘  └──────┬───────┘  └────────────────────────┘ │
│         │                │                                       │
│  ┌──────▼──────┐  ┌──────▼───────┐                             │
│  │ Event Engine│  │Rollback Engine│                             │
│  │ + Risk Score│  │+ Celery Queue │                             │
│  └──────┬──────┘  └──────┬───────┘                             │
└─────────┼────────────────┼────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│  Supabase       │  │  Upstash Redis   │  │  Google / Slack     │
│  PostgreSQL     │  │  Celery Broker   │  │  APIs               │
│  + Realtime     │  │                  │  │  (rollback targets) │
│  + Auth         │  └──────────────────┘  └─────────────────────┘
│  + Storage      │
└────────┬────────┘
         │ WebSocket (Realtime)
         ▼
┌──────────────────────────────────────────────────────────────────┐
│               FRONTEND (Vercel — Next.js)                        │
│   /timeline  /event/:id/diff  /event/:id/rollback  /audit        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Chrome Extension (MV3)

| Component | Responsibility |
|-----------|---------------|
| `service-worker.js` | Persistent event queue, alarm-based flush, auth token management |
| `gmail-interceptor.js` | Wraps `window.fetch` in main world; detects Gmail send API calls |
| `docs-interceptor.js` | Detects Drive auto-save calls; captures revision IDs |
| `slack-interceptor.js` | Detects `chat.postMessage` calls; captures `ts` from response |
| `popup.html/.js` | Extension toolbar UI; status, last event preview, dashboard link |

**Key MV3 constraints:**
- Background scripts run as Service Workers (terminate after ~30s idle)
- All events written to `chrome.storage.local` before network attempt
- Main-world script injection required for `window.fetch` interception
- 30-second `chrome.alarms` interval guarantees queue flush even after worker restart

### 3.2 FastAPI Backend

| Module | Responsibility |
|--------|---------------|
| `api/events.py` | POST /events — ingest, validate, classify, persist |
| `api/rollback.py` | POST /rollback/:id — queue async rollback job |
| `api/timeline.py` | GET /timeline — paginated, filtered event feed |
| `api/diff.py` | GET /events/:id/diff — fetch before/after + compute diff |
| `api/connectors.py` | CRUD for user OAuth connector records |
| `core/event_engine.py` | Idempotency check, diff computation, snapshot storage |
| `core/rollback_engine.py` | Rollback eligibility validation, Celery dispatch |
| `core/risk_classifier.py` | Rule-based risk scoring (no LLM) |
| `connectors/gmail.py` | Gmail API: trash message |
| `connectors/gdocs.py` | Drive API: restore revision |
| `connectors/slack.py` | Slack API: delete message |
| `workers/tasks.py` | Celery async rollback task with retry |

### 3.3 Supabase (Data Layer)

| Feature | Usage |
|---------|-------|
| PostgreSQL 15 | Primary event store, all application data |
| Row Level Security | Per-user data isolation enforced at DB level |
| Realtime | WebSocket push of INSERT/UPDATE events to dashboard |
| Auth | Google OAuth 2.0, JWT issuance and validation |
| Storage | Document snapshots, audit CSV exports |
| Vault | Encrypted OAuth token storage |

### 3.4 Next.js Dashboard

| Route | Component | Data Source |
|-------|-----------|-------------|
| `/timeline` | `TimelinePage` | Supabase Realtime + REST |
| `/event/:id/diff` | `DiffPage` | GET /events/:id/diff |
| `/event/:id/rollback` | `RollbackPage` | POST /rollback/:id |
| `/audit` | `AuditPage` | GET /timeline (full range) |
| `/settings/connectors` | `ConnectorsPage` | GET/POST /connectors |

---

## 4. Data Flow — Event Ingestion

```
1. AI agent calls Gmail API (send email)
2. Gmail Interceptor (main world) hooks window.fetch()
3. Interceptor captures: before snapshot (draft body), metadata
4. Original fetch() executes → Gmail returns {id, threadId}
5. Interceptor captures: after snapshot (message_id, sent_at)
6. Message sent to Service Worker via chrome.runtime.sendMessage
7. Service Worker writes event to chrome.storage.local (durable)
8. Service Worker attempts POST /api/v1/events with JWT
9. FastAPI validates JWT → runs risk classifier → computes diff
10. INSERT into events + snapshots tables
11. Supabase Realtime broadcasts INSERT to subscribed dashboard
12. Dashboard prepends new EventCard to timeline
13. Service Worker removes event from local queue on 200 response
```

---

## 5. Data Flow — Rollback Execution

```
1. User clicks Rollback → confirmation modal → confirms
2. Frontend: POST /api/v1/rollback/{event_id}
3. FastAPI validates JWT + ownership + rollback_status == "available"
4. INSERT into rollbacks (status: "pending")
5. Celery task enqueued via Upstash Redis
6. FastAPI returns 202 Accepted + rollback_id
7. Celery worker picks up task:
   a. Fetches event + snapshots from Supabase
   b. Decrypts OAuth token from connectors table
   c. Calls appropriate connector (gmail.trash / drive.restore / slack.delete)
   d. On success: UPDATE rollbacks (result="success") + UPDATE events (rollback_status="executed")
   e. On failure (after 3 retries): UPDATE rollbacks (result="failed", failure_reason=...)
8. Supabase Realtime broadcasts events UPDATE to dashboard
9. Dashboard shows ✓ success or ✗ failure with reason
```

---

## 6. Architecture Decision Records

### ADR-001 — Deterministic recorder, not AI monitor
**Decision:** Rule-based interception and risk classification only. No LLM in critical path.
**Reason:** The product's core value is trust. Determinism = trustworthiness. AI enrichment deferred to v3.

### ADR-002 — Append-only event log
**Decision:** Events are never updated or deleted. Rollbacks create new compensating events.
**Reason:** An editable audit trail cannot serve as a compliance instrument.

### ADR-003 — Chrome extension as primary sensor
**Decision:** MV3 browser extension, not a server-side proxy.
**Reason:** Zero infrastructure changes required by user. Installs in 60 seconds. Works with any agent.

### ADR-004 — Supabase as unified data platform
**Decision:** Single vendor for Postgres, Auth, Storage, Realtime.
**Reason:** Minimises operational complexity for a solo developer. RLS is architecturally correct for multi-tenant trust product.

### ADR-005 — Celery + Upstash for async rollback
**Decision:** Rollback jobs run async via Celery, not inline in the API request.
**Reason:** Third-party API calls (Google, Slack) can take 1–5 seconds and may fail. Async execution with retry prevents API timeouts and gives users real-time status feedback.
