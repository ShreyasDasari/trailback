# Flight Recorder
## Architecture Document
**Version:** 1.0.0
**Status:** Draft
**Last Updated:** February 2026
**Author:** Flight Recorder Engineering

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architectural Goals & Principles](#2-architectural-goals--principles)
3. [System Context Diagram](#3-system-context-diagram)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Component Architecture](#5-component-architecture)
6. [Data Architecture](#6-data-architecture)
7. [Event Sourcing & Rollback Design](#7-event-sourcing--rollback-design)
8. [Security Architecture](#8-security-architecture)
9. [Integration Architecture](#9-integration-architecture)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Scalability & Performance](#11-scalability--performance)
12. [Architecture Decision Records (ADRs)](#12-architecture-decision-records-adrs)

---

## 1. Executive Summary

Flight Recorder is a cross-application observability and rollback layer designed to sit between AI agents and the productivity tools they operate on. It intercepts, records, and provides recoverability for every action an AI agent takes across Gmail, Google Docs, and Slack — starting with the browser surface and expanding to deeper API integrations over time.

The architecture is built on four core principles: **intercept at the edge**, **persist immutably**, **rollback deterministically**, and **display transparently**. It does not attempt to judge agent actions with another AI layer — it is an engineering-grade recorder and undo stack, not a policy enforcer.

---

## 2. Architectural Goals & Principles

### Goals

| Goal | Description |
|------|-------------|
| **Completeness** | Every agent action must be captured. No silent operations. |
| **Recoverability** | Any logged action must have a defined rollback path or a documented reason why one is not possible. |
| **Tamper-proof logging** | Event logs must be append-only and immutable once written. |
| **Low latency overhead** | Interception must not measurably slow the user's workflow. Target: < 50ms overhead per action. |
| **Zero blind spots** | Even failed rollbacks must be surfaced to the user, not silently swallowed. |
| **Privacy by design** | Users own their data. No log content is accessible to Flight Recorder employees without explicit consent. |

### Principles

- **Determinism over AI**: The recorder is rule-based and deterministic. AI is not used for interception, logging, or rollback execution. AI is only an optional enrichment layer for human-readable summaries.
- **Append-only events**: Logs are never updated or deleted. Rollbacks create new compensating events — they do not erase history.
- **Fail-open**: If the recorder fails to log an action, the action should still proceed. Observability must never block the user's primary workflow.
- **Separation of concerns**: Interception (extension), storage (Supabase), orchestration (FastAPI), and presentation (Next.js) are fully decoupled and independently replaceable.

---

## 3. System Context Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                          │
│                                                                 │
│   ┌──────────────────┐    ┌────────────────────────────────┐   │
│   │   AI Agent Tab   │    │  Flight Recorder Extension     │   │
│   │  (e.g. Claude,   │───▶│  (Chrome MV3)                  │   │
│   │  GPT, Custom)    │    │  - Intercepts fetch/XHR        │   │
│   └──────────────────┘    │  - Captures DOM snapshots      │   │
│                           │  - Sends events to backend     │   │
│   ┌──────────────────┐    └──────────────┬─────────────────┘   │
│   │  Gmail / Docs /  │◀───── Rollback ───┘                     │
│   │  Slack Tab       │                                         │
│   └──────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
                                  │ HTTPS (events / rollback cmds)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FLIGHT RECORDER BACKEND                    │
│                                                                 │
│   ┌────────────────┐   ┌──────────────┐   ┌─────────────────┐ │
│   │  FastAPI Core  │──▶│ Event Engine │──▶│ Rollback Engine │ │
│   │  (REST API)    │   │ (ingest/diff)│   │ (connector calls│ │
│   └────────────────┘   └──────────────┘   └─────────────────┘ │
│             │                                       │           │
│             ▼                                       ▼           │
│   ┌────────────────┐                   ┌─────────────────────┐ │
│   │   Supabase DB  │                   │  Google / Slack APIs│ │
│   │   (Postgres)   │                   │  (rollback targets) │ │
│   └────────────────┘                   └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                  │ WebSocket (Realtime)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FLIGHT RECORDER DASHBOARD                   │
│                  (Next.js — Vercel hosted)                      │
│                                                                 │
│   Timeline View  │  Diff View  │  Rollback UI  │  Audit Trail  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. High-Level Architecture

Flight Recorder consists of four independently deployable layers:

### Layer 1 — The Sensor (Browser Extension)
The Chrome Extension (Manifest V3) is the "always-on recorder". It operates as a service worker and content script pair. Content scripts inject into Gmail, Google Docs, and Slack pages to observe DOM changes and intercept outgoing network requests. The service worker maintains a persistent connection to the backend for event streaming.

### Layer 2 — The Orchestrator (FastAPI Backend)
The backend is stateless and handles three responsibilities: event ingestion (write path), event querying (read path), and rollback execution (command path). It is built with Python FastAPI for its native async support and clean OpenAPI documentation generation. Background rollback jobs are queued via Celery + Upstash Redis to ensure rollback execution never blocks the API response.

### Layer 3 — The Store (Supabase)
All data is persisted in Supabase (managed PostgreSQL). Supabase Realtime (WebSocket) is used to push new events to connected dashboards without polling. Supabase Auth handles OAuth with Row Level Security ensuring strict per-user data isolation. File snapshots and exported audit trails are stored in Supabase Storage.

### Layer 4 — The Interface (Next.js Dashboard)
The web dashboard provides three primary views: the Timeline (chronological action feed), the Diff View (before/after comparison for each action), and the Rollback UI (one-click undo with confirmation). It is hosted on Vercel for zero-config edge deployment.

---

## 5. Component Architecture

### 5.1 Chrome Extension Components

```
extension/
├── manifest.json              # MV3 configuration + permissions
├── background/
│   └── service-worker.js      # Persistent event queue + backend sync
├── content-scripts/
│   ├── gmail-interceptor.js   # Gmail DOM observer + fetch hook
│   ├── docs-interceptor.js    # Docs revision capture
│   └── slack-interceptor.js   # Slack message interceptor
├── popup/
│   ├── popup.html             # Extension toolbar popup
│   └── popup.js               # Status + quick rollback trigger
└── utils/
    ├── diff.js                # Client-side diff computation
    ├── serializer.js          # Snapshot serialization
    └── auth.js                # OAuth token management
```

**Key MV3 Permissions Required:**
- `activeTab` — read current tab context
- `scripting` — inject content scripts dynamically
- `storage` — persist event queue locally before sync
- `identity` — Google OAuth token acquisition
- Host permissions: `https://mail.google.com/*`, `https://docs.google.com/*`, `https://slack.com/*`

### 5.2 FastAPI Backend Components

```
backend/
├── main.py                    # FastAPI app entry point
├── api/
│   ├── events.py              # POST /events, GET /events
│   ├── rollback.py            # POST /rollback/{event_id}
│   ├── timeline.py            # GET /timeline
│   ├── diff.py                # GET /diff/{event_id}
│   ├── connectors.py          # GET/POST /connectors
│   └── audit.py               # GET /audit (team export)
├── core/
│   ├── event_engine.py        # Event ingestion + diff computation
│   ├── rollback_engine.py     # Rollback orchestration
│   ├── risk_classifier.py     # Rule-based risk scoring
│   └── snapshot.py            # Before/after state management
├── connectors/
│   ├── gmail.py               # Gmail API rollback connector
│   ├── gdocs.py               # Google Docs API connector
│   └── slack.py               # Slack Web API connector
├── workers/
│   └── tasks.py               # Celery async rollback tasks
├── models/
│   ├── event.py               # Pydantic event schema
│   ├── rollback.py            # Pydantic rollback schema
│   └── connector.py           # Pydantic connector schema
└── db/
    └── supabase_client.py     # Supabase Python client wrapper
```

### 5.3 Next.js Dashboard Components

```
frontend/
├── app/
│   ├── layout.tsx             # Root layout + auth guard
│   ├── (auth)/
│   │   └── login/             # Google OAuth login page
│   ├── timeline/
│   │   └── page.tsx           # Main timeline feed
│   ├── event/[id]/
│   │   ├── diff/page.tsx      # Before/after diff view
│   │   └── rollback/page.tsx  # Rollback confirmation
│   ├── audit/
│   │   └── page.tsx           # Team audit trail export
│   └── settings/
│       └── page.tsx           # Connector management
├── components/
│   ├── timeline/
│   │   ├── EventCard.tsx      # Single event in the feed
│   │   ├── RiskBadge.tsx      # LOW / MEDIUM / CRITICAL badge
│   │   └── AppIcon.tsx        # Gmail / Docs / Slack icons
│   ├── diff/
│   │   ├── DiffViewer.tsx     # react-diff-viewer wrapper
│   │   └── SnapshotPanel.tsx  # Before / After side panels
│   └── rollback/
│       ├── RollbackButton.tsx # One-click trigger
│       └── RollbackStatus.tsx # Success / Failed / Partial
├── lib/
│   ├── supabase.ts            # Supabase client + realtime
│   └── api.ts                 # Backend API client
└── hooks/
    ├── useTimeline.ts         # Realtime event feed hook
    └── useRollback.ts         # Rollback mutation hook
```

---

## 6. Data Architecture

### 6.1 Core Schema

```sql
-- Every agent action, one row per atomic operation
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    agent_id        TEXT NOT NULL,               -- "claude-desktop", "custom-agent-1"
    app             TEXT NOT NULL,               -- "gmail" | "gdocs" | "slack"
    action_type     TEXT NOT NULL,               -- "email.send" | "doc.edit" | "message.post"
    intent          TEXT,                        -- Agent's stated purpose (if available)
    status          TEXT NOT NULL DEFAULT 'completed', -- "completed" | "rolled_back" | "partial"
    risk_level      TEXT NOT NULL DEFAULT 'low', -- "low" | "medium" | "high" | "critical"
    rollback_status TEXT DEFAULT 'available',    -- "available" | "executed" | "unavailable" | "failed"
    metadata        JSONB,                       -- App-specific context (email subject, doc title, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Before/after snapshots for every event
CREATE TABLE snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    snapshot_type   TEXT NOT NULL,               -- "before" | "after"
    content         JSONB NOT NULL,              -- Serialized state (email body, doc content, etc.)
    content_hash    TEXT NOT NULL,               -- SHA-256 of content for integrity verification
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full rollback operation history
CREATE TABLE rollbacks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    initiated_by    TEXT NOT NULL,               -- "user" | "automated_policy"
    result          TEXT NOT NULL,               -- "success" | "failed" | "partial"
    failure_reason  TEXT,                        -- Populated on failure
    api_response    JSONB,                       -- Raw response from Google/Slack API
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User's connected third-party apps
CREATE TABLE connectors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    app             TEXT NOT NULL,               -- "gmail" | "gdocs" | "slack"
    oauth_token     TEXT,                        -- Encrypted OAuth access token
    refresh_token   TEXT,                        -- Encrypted OAuth refresh token
    scopes          TEXT[],                      -- Granted OAuth scopes
    connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    UNIQUE(user_id, app)
);

-- Registered agents and their trust profile
CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    name            TEXT NOT NULL,               -- Human-readable agent name
    agent_key       TEXT UNIQUE NOT NULL,        -- API key for agent identification
    total_actions   INTEGER DEFAULT 0,
    rolled_back     INTEGER DEFAULT 0,
    trust_score     FLOAT DEFAULT 1.0,           -- Computed: 1 - (rolled_back / total_actions)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.2 Row Level Security Policies

All tables enforce RLS. Users can only read and write their own data.

```sql
-- Events: users see only their own
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_events" ON events
    USING (auth.uid() = user_id);

-- Snapshots: accessible only via owned events
CREATE POLICY "users_own_snapshots" ON snapshots
    USING (event_id IN (
        SELECT id FROM events WHERE user_id = auth.uid()
    ));
```

### 6.3 Indexing Strategy

```sql
CREATE INDEX idx_events_user_id_created ON events(user_id, created_at DESC);
CREATE INDEX idx_events_app ON events(app);
CREATE INDEX idx_events_risk_level ON events(risk_level);
CREATE INDEX idx_events_rollback_status ON events(rollback_status);
CREATE INDEX idx_snapshots_event_id ON snapshots(event_id);
```

---

## 7. Event Sourcing & Rollback Design

### 7.1 Event Sourcing Model

Flight Recorder uses a simplified event sourcing pattern. Every agent action is modelled as an immutable event. State is never overwritten — rollbacks produce compensating events that logically reverse the original, but both events persist permanently.

```
Event Log (append-only):
─────────────────────────────────────────────────────────────────
T+0  │ event_id: A1 │ action: email.send   │ status: completed
T+1  │ event_id: A2 │ action: doc.edit     │ status: completed
T+2  │ event_id: R1 │ action: email.trash  │ status: rollback_of: A1
T+3  │ event_id: A3 │ action: msg.post     │ status: completed
─────────────────────────────────────────────────────────────────
```

Current state is derived by reading the log, not by mutating records.

### 7.2 Rollback Availability Matrix

| App | Action | Rollback Method | Window | Availability |
|-----|--------|----------------|--------|--------------|
| Gmail | Send email | Move to trash via Gmail API | Unlimited | ✅ Always |
| Gmail | Delete email | Restore from trash | 30 days | ✅ Within window |
| Google Docs | Edit content | Restore revision via Docs Revisions API | Unlimited | ✅ Always |
| Google Docs | Delete document | Restore from Drive trash | 30 days | ✅ Within window |
| Slack | Post message | Delete via `chat.delete` | < 90 seconds | ⚠️ Time-limited |
| Slack | Post message | Delete (admin) | No limit (admin only) | ⚠️ Requires admin |
| Google Calendar | Create event | Delete via Calendar API | Unlimited | ✅ Always |

### 7.3 Rollback Execution Flow

```
User clicks "Rollback" on event A1
        │
        ▼
POST /rollback/A1
        │
        ▼
Rollback Engine validates:
  - Does event exist?
  - Is rollback_status = "available"?
  - Is the connector for this app authorized?
        │
        ▼
Background job queued via Celery
        │
        ▼
Connector called (e.g. gmail.trash(message_id))
        │
     ┌──┴──────────────────────────────────────┐
     │ Success                              Failure
     ▼                                         ▼
New rollback event written         rollbacks table updated
event.rollback_status = "executed"  result = "failed"
                                    failure_reason logged
        │                                     │
        └──────────────┬──────────────────────┘
                       ▼
          Supabase Realtime pushes
          update to dashboard
```

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
User → Google OAuth 2.0 → Supabase Auth → JWT issued
JWT included in every API request (Authorization: Bearer <token>)
FastAPI validates JWT via Supabase public key
RLS enforces data isolation at database level
```

### 8.2 OAuth Token Storage

OAuth tokens for Google and Slack are stored encrypted in the `connectors` table. Encryption uses AES-256 via Supabase Vault. Tokens are never returned raw to the frontend — the backend holds and uses them on behalf of the user.

### 8.3 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Token theft | OAuth tokens encrypted at rest, never exposed to frontend |
| Log tampering | Append-only event table with no update/delete permissions for app user |
| Cross-user data access | Supabase RLS enforces strict per-user isolation |
| MITM on extension | HTTPS-only communication, extension enforces CSP |
| Malicious agent impersonation | Agent API keys are per-user, rate-limited, and scoped |
| Rollback abuse | Rollback operations require user authentication and are themselves logged |

---

## 9. Integration Architecture

### 9.1 Gmail Integration

- **Auth:** Google OAuth 2.0, scope `https://www.googleapis.com/auth/gmail.modify`
- **Interception:** Content script hooks `fetch()` calls on `mail.google.com`, detecting calls to `gmail.googleapis.com/gmail/v1/users/me/messages/send`
- **Snapshot:** Before state = draft content captured from DOM before send. After state = message ID + thread ID returned by API.
- **Rollback:** `POST /gmail/v1/users/me/messages/{id}/trash`

### 9.2 Google Docs Integration

- **Auth:** Google OAuth 2.0, scopes `drive.file`, `documents`
- **Interception:** Docs auto-saves are detected via `docs.googleapis.com/v1/documents/{docId}` PUT intercepts.
- **Snapshot:** Before state = revision ID fetched via `drive.revisions.list` before the edit. After state = new revision ID after save.
- **Rollback:** `POST /drive/v2/files/{fileId}/revisions/{revisionId}` to restore prior revision.

### 9.3 Slack Integration

- **Auth:** Slack OAuth 2.0, scopes `chat:write`, `chat:delete`, `channels:history`
- **Interception:** Content script on `app.slack.com` intercepts `api.slack.com/api/chat.postMessage`
- **Snapshot:** Message text + channel captured before posting. `ts` (timestamp ID) captured from API response.
- **Rollback:** `POST api.slack.com/api/chat.delete` with captured `ts`

---

## 10. Deployment Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vercel     │    │   Render         │    │   Supabase      │
│  (Frontend)  │    │   (Backend)      │    │  (Data Layer)   │
│              │    │                  │    │                 │
│  Next.js app │───▶│  FastAPI + Uvicorn│───▶│  PostgreSQL     │
│  Edge CDN    │    │  Celery worker   │    │  Realtime WS    │
│  Auto-deploy │    │  (same instance) │    │  Auth           │
│  from GitHub │    │                  │    │  Storage        │
└──────────────┘    └──────────────────┘    └─────────────────┘
                              │
                    ┌─────────▼────────┐
                    │    Upstash Redis  │
                    │  (Task queue)    │
                    └──────────────────┘

GitHub → GitHub Actions → (test + lint) → deploy to Vercel + Render
```

### Environment Configuration

```
# Backend (.env)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
UPSTASH_REDIS_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
JWT_SECRET=

# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

---

## 11. Scalability & Performance

### Bottleneck Analysis

| Component | Bottleneck | Mitigation |
|-----------|-----------|-----------|
| Event ingestion | High-frequency agents sending many events/sec | Batch ingest endpoint + client-side debouncing |
| Rollback execution | Google/Slack API rate limits | Celery queue with exponential backoff retry |
| Dashboard real-time | WebSocket connection limits on free tier | Pagination + lazy loading; Realtime only for latest 50 events |
| Diff computation | Large document diffs | `deepdiff` with configurable depth limit + async processing |

### Free Tier Limits to Monitor

| Service | Limit | Flight Recorder Usage |
|---------|-------|----------------------|
| Supabase | 500MB DB | ~1K events ≈ 1MB, scalable to 500K events |
| Supabase Realtime | 200 concurrent connections | Sufficient for MVP (< 50 users) |
| Render | 512MB RAM, spins down | Acceptable for MVP; upgrade at first revenue |
| Upstash Redis | 10K commands/day | ~100 rollback jobs/day well within limit |
| Gmail API | 1B units/day | Negligible |

---

## 12. Architecture Decision Records (ADRs)

### ADR-001: Deterministic Recorder, Not AI-Powered Monitor
**Decision:** Flight Recorder uses rule-based interception and diff computation rather than LLM-based monitoring.
**Rationale:** Determinism is the product's core value proposition. Users trust it *because* it always records, always diffs, and always rolls back the same way. Adding an LLM to judge actions introduces non-determinism, cost, and potential failure modes. AI enrichment (natural language summaries) is deferred to Phase 3 as an optional layer on top of ground-truth logs.
**Consequence:** The product may feel "less smart" initially, but will be more trustworthy and debuggable.

### ADR-002: Append-Only Event Log
**Decision:** Events are never updated or deleted. Rollbacks produce compensating events.
**Rationale:** An editable event log cannot serve as a trust and compliance instrument. If users or admins could delete events, the audit trail is worthless. Compensating events preserve the full history while clearly marking what was reversed.
**Consequence:** Database storage grows monotonically. Mitigation: configurable log retention windows (e.g., 90-day free tier, unlimited paid).

### ADR-003: Browser Extension as Primary Sensor
**Decision:** Chrome Extension (MV3) is the primary interception mechanism for MVP, not a server-side proxy.
**Rationale:** A browser extension requires no infrastructure changes for the AI agent or the target app. It can be installed in under 60 seconds and works across all agent types (Claude, GPT, custom). A server-side proxy would require DNS changes, SSL certificate management, and add latency — inappropriate for MVP.
**Consequence:** Limited to Chromium-based browsers at launch. Firefox and Safari support deferred to v2.

### ADR-004: Supabase for All Data Services
**Decision:** Use Supabase as the unified data platform (Postgres, Auth, Storage, Realtime) rather than separate services.
**Rationale:** For a solo student developer, minimizing the number of services to manage is critical. Supabase's free tier covers all data needs, and its RLS feature is architecturally correct for a multi-tenant trust product. The tradeoff is vendor lock-in to Supabase's managed Postgres, which is mitigated by the fact that Supabase is open source and self-hostable.
**Consequence:** Migration off Supabase later requires standard Postgres migration tooling — manageable risk.
