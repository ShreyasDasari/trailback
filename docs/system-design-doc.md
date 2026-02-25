# Flight Recorder
## System Design Document
**Version:** 1.0.0
**Status:** Final — MVP
**Last Updated:** February 2026
**Audience:** Engineering (Backend, Frontend, Extension)

---

## Table of Contents

1. [Requirements Summary](#1-requirements-summary)
2. [Capacity Estimation](#2-capacity-estimation)
3. [High-Level System Design](#3-high-level-system-design)
4. [Deep Dive: Event Ingestion Pipeline](#4-deep-dive-event-ingestion-pipeline)
5. [Deep Dive: Rollback Execution Pipeline](#5-deep-dive-rollback-execution-pipeline)
6. [Deep Dive: Real-time Dashboard Pipeline](#6-deep-dive-real-time-dashboard-pipeline)
7. [Deep Dive: Chrome Extension Design](#7-deep-dive-chrome-extension-design)
8. [Database Design](#8-database-design)
9. [API Design](#9-api-design)
10. [Caching Strategy](#10-caching-strategy)
11. [Failure Modes & Recovery](#11-failure-modes--recovery)
12. [Data Flow Diagrams](#12-data-flow-diagrams)
13. [Security Design](#13-security-design)
14. [Observability & Monitoring](#14-observability--monitoring)

---

## 1. Requirements Summary

### Functional Requirements (System Perspective)
- Accept and persist structured event objects from the Chrome extension at low latency
- Compute before/after diffs for document-type events (Google Docs)
- Execute rollback operations against third-party APIs (Gmail, Docs, Slack) asynchronously
- Push newly ingested events to connected browser clients in real-time (< 2s)
- Enforce per-user data isolation at every layer (API, DB, cache)

### Non-Functional Requirements
- **Write latency:** P95 < 200ms for POST /events
- **Read latency:** P95 < 150ms for GET /timeline (paginated)
- **Rollback execution:** < 5 seconds end-to-end
- **Real-time push:** < 2 seconds from event write to dashboard display
- **Throughput:** Support 100 concurrent users writing events (MVP scale)
- **Availability:** 99.5% uptime for backend API
- **Durability:** Zero event loss after successful API acknowledgement

---

## 2. Capacity Estimation

### MVP Scale Assumptions (500 Active Users)

```
Users:          500 monthly active users
                100 daily active users
                10 concurrent users at peak

Event volume:
  Per user/day: ~50 agent actions (emails, doc edits, Slack posts)
  Per day:      100 users × 50 events = 5,000 events/day
  Per second:   ~0.06 events/sec (average)
  Peak (9-5pm): ~0.3 events/sec

Event payload size:
  Metadata:     ~500 bytes
  Snapshot:     ~5KB average (email body or doc excerpt)
  Per event:    ~10KB (before + after snapshot)

Storage:
  Events/day:   5,000 × 10KB = 50MB/day
  Events/month: ~1.5GB/month
  Free tier limit: 500MB (Supabase) → enforce 90-day rolling retention

Rollback jobs:
  ~5% of events trigger rollback = 250 rollbacks/day
  Each Celery job: ~1–3 seconds execution time
  Queue depth: < 10 jobs outstanding at any time (MVP scale)

Dashboard reads:
  100 DAU × 5 timeline reads/day = 500 reads/day
  Each read: ~20 rows × ~500 bytes = 10KB
  Total read bandwidth: 5MB/day (negligible)
```

### Conclusion
At MVP scale, a single Render instance (512MB RAM, 0.5 vCPU) is sufficient. Supabase free tier (500MB storage) supports approximately 50K events with 90-day retention. No horizontal scaling required before 2,000+ active users.

---

## 3. High-Level System Design

```
╔══════════════════════════════════════════════════════════════════╗
║                    CLIENT LAYER                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  ┌─────────────────────────┐   ┌──────────────────────────────┐ ║
║  │   Chrome Extension      │   │   Next.js Dashboard          │ ║
║  │   (Manifest V3)         │   │   (Vercel CDN)               │ ║
║  │                         │   │                              │ ║
║  │  ┌───────────────────┐  │   │  Timeline │ Diff │ Rollback  │ ║
║  │  │ Content Scripts   │  │   │                              │ ║
║  │  │ - Gmail           │  │   │  Supabase Realtime (WS)      │ ║
║  │  │ - Google Docs     │  │   │  ◀──────────────────────────◀│ ║
║  │  │ - Slack           │  │   └──────────────────────────────┘ ║
║  │  └─────────┬─────────┘  │                  ▲                 ║
║  │            │            │                  │                 ║
║  │  ┌─────────▼─────────┐  │                  │ WebSocket       ║
║  │  │  Service Worker   │  │                  │                 ║
║  │  │  Event Queue      │  │                  │                 ║
║  └──┼──────────┬────────┼──┘                  │                 ║
╚═══════════════╪════════════════════════════════╪════════════════╝
                │ HTTPS POST /events             │ Realtime Events
                ▼                               │
╔══════════════════════════════════════════════════════════════════╗
║                   BACKEND LAYER                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │                  FastAPI Application                      │   ║
║  │                                                          │   ║
║  │  ┌─────────────┐  ┌────────────────┐  ┌──────────────┐ │   ║
║  │  │ Event API   │  │  Rollback API  │  │  Query API   │ │   ║
║  │  │ /events     │  │  /rollback     │  │  /timeline   │ │   ║
║  │  │ (write path)│  │  (cmd path)    │  │  /diff       │ │   ║
║  │  └──────┬──────┘  └───────┬────────┘  └──────┬───────┘ │   ║
║  │         │                 │                   │          │   ║
║  │  ┌──────▼──────┐  ┌───────▼──────┐            │          │   ║
║  │  │ Event Engine│  │ Rollback Eng │            │          │   ║
║  │  │ - Validation│  │ - Auth check │            │          │   ║
║  │  │ - Diff calc │  │ - Job queue  │            │          │   ║
║  │  │ - Risk class│  └───────┬──────┘            │          │   ║
║  │  └──────┬──────┘          │                   │          │   ║
║  └─────────┼─────────────────┼───────────────────┼──────────┘   ║
║            │                 │                   │              ║
║  ┌─────────▼──────┐ ┌────────▼───────┐           │              ║
║  │  Supabase DB   │ │ Upstash Redis  │           │              ║
║  │  (PostgreSQL)  │ │ (Celery Queue) │           │              ║
║  │  + Realtime ───┼─┼───────────────────────────▶│              ║
║  │  + Auth        │ │                │           │              ║
║  │  + Storage     │ │                │           │              ║
║  └────────────────┘ └──────┬─────────┘           │              ║
║                            │                     │              ║
║  ┌─────────────────────────▼──────────────────┐  │              ║
║  │              Celery Worker                  │  │              ║
║  │   execute_rollback(event_id, app, metadata) │  │              ║
║  │   ──▶ Gmail API  ──▶ status update ──▶ DB  │  │              ║
║  │   ──▶ Docs API   ──▶ status update ──▶ DB  │  │              ║
║  │   ──▶ Slack API  ──▶ status update ──▶ DB  │  │              ║
║  └────────────────────────────────────────────┘  │              ║
╚══════════════════════════════════════════════════════════════════╝

External APIs: Gmail REST API | Google Drive API | Slack Web API
```

---

## 4. Deep Dive: Event Ingestion Pipeline

### Flow

```
[Content Script] → intercepts fetch() → captures payload
        │
        ▼
[Service Worker] ← receives via chrome.runtime.sendMessage
        │
        ├── Queue event in chrome.storage.local (fail-safe)
        │
        └── POST /api/v1/events
                │
                ▼
        [FastAPI /events endpoint]
                │
                ├── 1. JWT validation (Supabase public key)
                │
                ├── 2. Pydantic schema validation
                │
                ├── 3. Risk classification
                │       risk_classifier.classify_event(...)
                │
                ├── 4. Diff computation (for doc edits)
                │       deepdiff.DeepDiff(before, after)
                │
                ├── 5. Persist to Supabase
                │       INSERT INTO events (...)
                │       INSERT INTO snapshots (before)
                │       INSERT INTO snapshots (after)
                │
                └── 6. Return 201 with event_id + risk_level
                        │
                        ▼
                [Service Worker dequeues event from local storage]
```

### Idempotency
The extension includes a client-generated `idempotency_key` (UUID v4) in each request. The backend checks for existing events with the same key before inserting, preventing duplicate events if the extension retries a failed request.

```python
# Idempotency check in event engine
async def ingest_event(event: EventSchema, user_id: str) -> EventRecord:
    # Check for duplicate
    existing = await db.events.find_one(
        user_id=user_id,
        idempotency_key=event.idempotency_key
    )
    if existing:
        return existing  # Return existing record, skip insert

    # Proceed with insert
    ...
```

### Diff Computation Strategy

| App | Action Type | Diff Method | Details |
|-----|------------|------------|---------|
| Google Docs | `doc.edit` | Character-level text diff | `deepdiff` on extracted plain text |
| Gmail | `email.send` | No diff (new content) | Before = draft, After = sent message |
| Slack | `message.post` | No diff (new content) | Before = null, After = message text |
| Google Docs | `doc.delete` | File existence diff | Before = file metadata, After = null |

---

## 5. Deep Dive: Rollback Execution Pipeline

### Flow

```
[User] clicks Rollback → confirmation modal → confirms
        │
        ▼
[Frontend] POST /api/v1/rollback/{event_id}
        │
        ▼
[FastAPI /rollback endpoint]
        │
        ├── 1. Validate JWT + ownership of event
        │
        ├── 2. Check rollback eligibility
        │       event.rollback_status == "available"?
        │       connector for this app active?
        │       oauth token for this app valid?
        │
        ├── 3. Create rollback record (status: "pending")
        │
        ├── 4. Enqueue Celery task
        │       execute_rollback.delay(rollback_id, event_id, ...)
        │
        └── 5. Return 202 Accepted + rollback_id
                │
                ▼
        [Celery Worker picks up task]
                │
                ├── Retrieve event + snapshots from DB
                │
                ├── Retrieve oauth_token for app from connectors table
                │
                ├── Call appropriate connector:
                │     Gmail:  gmail.trash(message_id)
                │     Docs:   drive.restore_revision(file_id, revision_id)
                │     Slack:  slack.delete(channel, ts)
                │
                ├── On success:
                │     UPDATE rollbacks SET result='success'
                │     UPDATE events SET rollback_status='executed', status='rolled_back'
                │
                └── On failure (after 3 retries):
                      UPDATE rollbacks SET result='failed', failure_reason=str(exc)
                      UPDATE events SET rollback_status='failed'

[Supabase Realtime] broadcasts events table UPDATE to dashboard
[Frontend] receives update, shows success/failure banner
```

### Retry Strategy

```python
@app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,  # 5 seconds between retries
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,      # Exponential: 5s, 10s, 20s
    retry_jitter=True        # Add randomness to avoid thundering herd
)
def execute_rollback(self, ...):
    ...
```

### Rollback Unavailability Handling

When rollback is not possible, the system communicates this clearly:

```python
ROLLBACK_UNAVAILABLE_REASONS = {
    'slack_outside_window': "Slack messages can only be deleted within 90 seconds of posting by standard accounts. This message is outside that window.",
    'slack_no_admin': "Deleting this Slack message requires admin permissions. Please ask a workspace admin to delete it manually.",
    'gmail_no_token': "Your Gmail authorization has expired. Reconnect Gmail in Settings to enable rollback.",
    'docs_no_revision': "This document edit cannot be rolled back because the revision ID was not captured.",
}
```

---

## 6. Deep Dive: Real-time Dashboard Pipeline

### Architecture

Supabase Realtime uses PostgreSQL's logical replication (WAL) to stream database changes to subscribed clients via WebSocket. This eliminates the need for polling and is included free in Supabase's managed tier.

```
[FastAPI Backend] writes event to Supabase Postgres
        │
        ▼
[PostgreSQL WAL (Write-Ahead Log)] records the INSERT
        │
        ▼
[Supabase Realtime Server] reads WAL changes
        │
        ▼ WebSocket push
[Browser Dashboard] receives 'postgres_changes' event
        │
        ▼
[React state update] → new EventCard appears at top of timeline
```

### Client Subscription

```typescript
// Dashboard subscribes to events table changes for the current user
const channel = supabase
  .channel(`timeline-${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'events',
    filter: `user_id=eq.${userId}`  // RLS further enforces this server-side
  }, (payload) => {
    const newEvent = payload.new as EventRecord;
    setEvents(prev => [newEvent, ...prev.slice(0, 49)]); // Keep last 50
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'events',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Handle rollback_status updates
    setEvents(prev => prev.map(e =>
      e.id === payload.new.id ? { ...e, ...payload.new } : e
    ));
  })
  .subscribe();
```

---

## 7. Deep Dive: Chrome Extension Design

### MV3 Service Worker Lifecycle Problem

In MV3, background scripts are Service Workers that terminate after ~30 seconds of inactivity. This creates a risk: if the service worker is terminated, pending events in memory are lost.

**Solution:** All events are immediately written to `chrome.storage.local` before any network attempt. The service worker reads from this queue on startup and on a 30-second `chrome.alarms` interval.

```javascript
// Guaranteed delivery sequence
async function captureAndQueue(event) {
  // Step 1: Persist to local storage (synchronous-equivalent)
  const queue = await chrome.storage.local.get('event_queue');
  const currentQueue = queue.event_queue || [];
  currentQueue.push({ ...event, id: crypto.randomUUID(), ts: Date.now() });
  await chrome.storage.local.set({ event_queue: currentQueue });

  // Step 2: Attempt immediate flush (best effort)
  flushQueue(); // Non-blocking, may fail silently

  // Step 3: Guaranteed flush via alarm (even if worker was terminated)
  // chrome.alarms.create('flush', { delayInMinutes: 0.5 }) ← set at install time
}
```

### Content Script Isolation

Content scripts run in an isolated world — they can read/modify the DOM but cannot directly access the page's JavaScript variables. To intercept `fetch()` calls made by the AI agent's JavaScript running in the main page, a script must be injected into the **main world**:

```javascript
// background/service-worker.js — injected at tab activation
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  world: 'MAIN',        // ← Critical: runs in the page's JS context
  func: injectFetchInterceptor
});

function injectFetchInterceptor() {
  // This runs in the MAIN world — can wrap window.fetch
  const origFetch = window.fetch;
  window.fetch = async (...args) => { ... };
}
```

### Message Passing Architecture

```
Main World (page JS)       Isolated World (content script)     Service Worker
─────────────────────      ────────────────────────────────    ────────────────
window.fetch intercepted → postMessage(event, '*')          
                                      │
                           window.addEventListener           
                           ('message', handler)              
                                      │
                           chrome.runtime.sendMessage ──────▶ onMessage handler
                                                                      │
                                                              queueAndSync(event)
```

---

## 8. Database Design

### Entity-Relationship Overview

```
auth.users (Supabase managed)
    │ 1:N
    ├──▶ events
    │       │ 1:N
    │       └──▶ snapshots (before + after)
    │       │ 1:N
    │       └──▶ rollbacks
    │
    ├──▶ connectors (1 per app per user)
    │
    └──▶ agents
```

### Query Patterns & Index Rationale

**Pattern 1 — Timeline feed (most frequent read)**
```sql
SELECT * FROM events
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20 OFFSET $2;
-- Index: (user_id, created_at DESC) ← covers this fully
```

**Pattern 2 — Diff view (event + both snapshots)**
```sql
SELECT e.*, s_before.content AS before, s_after.content AS after
FROM events e
JOIN snapshots s_before ON s_before.event_id = e.id AND s_before.snapshot_type = 'before'
JOIN snapshots s_after ON s_after.event_id = e.id AND s_after.snapshot_type = 'after'
WHERE e.id = $1 AND e.user_id = $2;
-- Index: snapshots(event_id) ← covers join efficiently
```

**Pattern 3 — Risk filter**
```sql
SELECT * FROM events
WHERE user_id = $1 AND risk_level = $2
ORDER BY created_at DESC LIMIT 20;
-- Index: (user_id, created_at DESC) + (risk_level) ← composite helpful
```

### Storage Estimation & Retention Policy

```
Event row:          ~1KB (metadata JSONB)
Snapshot pair:      ~10KB (before + after content)
Full event:         ~11KB

At 5,000 events/day:
  Daily growth:     ~55MB
  Monthly growth:   ~1.65GB

Supabase free tier: 500MB
  Buffer before cleanup: ~9 days at MVP scale

Retention policy:
  Free plan:   7 days rolling retention (nightly cleanup job)
  Pro plan:    90 days
  Team plan:   1 year
  Compliance:  Unlimited
```

---

## 9. API Design

### Design Principles
- RESTful resource-oriented endpoints
- Consistent error format across all endpoints
- Pagination on all list endpoints
- All timestamps in ISO 8601 UTC
- Versioned under `/api/v1/`

### Error Response Format
```json
{
  "error": {
    "code": "ROLLBACK_UNAVAILABLE",
    "message": "This Slack message is outside the 90-second deletion window.",
    "details": {
      "event_id": "uuid",
      "reason_key": "slack_outside_window",
      "posted_at": "2026-02-23T14:30:00Z"
    }
  }
}
```

### Rate Limiting
```python
# Applied per user_id via Redis counter
# POST /events: 60 requests/minute (generous for agent use)
# POST /rollback: 10 requests/minute (prevent accidental spam)
# GET endpoints: 120 requests/minute
```

### Complete Endpoint Reference

```
POST   /api/v1/events                    Ingest event from extension
GET    /api/v1/timeline                  Paginated event feed
GET    /api/v1/events/{id}               Single event detail
GET    /api/v1/events/{id}/diff          Before/after diff
POST   /api/v1/rollback/{event_id}       Initiate rollback
GET    /api/v1/rollback/{id}/status      Poll rollback status
GET    /api/v1/connectors                List connected apps
POST   /api/v1/connectors/{app}/connect  Initiate OAuth for app
DELETE /api/v1/connectors/{app}          Disconnect app
GET    /api/v1/agents                    List registered agents
POST   /api/v1/agents                    Register new agent
GET    /api/v1/audit                     Export audit trail (CSV)
GET    /api/v1/health                    Health check (no auth)
```

---

## 10. Caching Strategy

### What to Cache

| Data | Cache Location | TTL | Rationale |
|------|---------------|-----|-----------|
| OAuth tokens | Encrypted in DB (not cache) | — | Security: never in memory cache |
| User connector status | Request-level cache | — | Small, changes infrequently |
| Timeline page 1 (20 events) | No cache | — | Must be real-time accurate |
| Diff computation result | In-memory (per request) | — | Computed once, returned immediately |
| Risk classification result | Stored in DB after first compute | — | Never recomputed for same event |

### Cache Decision: Keep It Simple

At MVP scale, no Redis-based response caching is needed. The bottleneck is not repeated reads of the same data — it's the cost of initial computation (diff, risk classification). Both are computed once on ingest and stored in the database. Subsequent reads are cheap Postgres selects.

The only Redis usage in the MVP is the **Celery task queue** (via Upstash), not response caching.

---

## 11. Failure Modes & Recovery

### Failure Mode Matrix

| Component | Failure | Impact | Recovery |
|-----------|---------|--------|---------|
| Chrome Extension service worker | Terminated by browser | Events in-flight may be lost from memory | Local `chrome.storage` queue absorbs all events; flushed on next alarm tick |
| Backend API (Render) | Cold start or down | Extension cannot sync events | Local queue holds events up to chrome.storage limit (~5MB); auto-flushes on reconnect |
| Supabase | Temporary unavailability | Events cannot be persisted | API returns 503; extension retries with exponential backoff; events remain in local queue |
| Celery worker | Crash during rollback | Rollback status stuck in "pending" | Celery task retry with max_retries=3; on exhaustion, rollback status set to "failed" with reason |
| Google API rate limit | 429 from Gmail/Docs | Rollback delayed | Celery task retries with exponential backoff; user shown "pending" status |
| Slack deletion window | `msg_too_old` from Slack API | Rollback not possible | `rollback_status` = "unavailable", clear message shown to user |
| OAuth token expiry | 401 from Google/Slack | Rollback fails | User prompted to re-authenticate in Settings |
| Realtime WebSocket | Connection lost | Dashboard doesn't update live | Dashboard shows "Live updates paused" banner; on reconnect, fetches missed events via REST |

### Extension Resilience: The Queue Contract

The service worker guarantees **at-least-once delivery** of every captured event:

```
Event captured
     │
     ▼
Written to chrome.storage (durable) ← CONFIRMED safe
     │
     ├── Attempt immediate sync (may fail)
     │
     └── Alarm fires every 30s (even if worker was killed and restarted)
             │
             └── Flush all pending events from storage
                     │
                     └── On 200 response: remove from storage
                         On failure: keep in storage, retry on next alarm
```

---

## 12. Data Flow Diagrams

### Flow 1: Email Send Capture (Happy Path)

```
AI Agent                Gmail Page              Extension          Backend           Database
───────────────────────────────────────────────────────────────────────────────────────────
Calls Gmail             fetch() intercepted
compose send API   ──▶  by main-world injector
                              │
                        Captures: to, subject,
                        body (before snapshot)
                              │
                        Calls original fetch() ──▶ gmail.googleapis.com
                              │                    Returns: { id, threadId }
                        Captures after snapshot        │
                              │◀──────────────────────┘
                        Sends message to
                        service worker
                              │
                              └──▶ Queue locally ──▶ POST /events ──▶ Validate JWT
                                                                         │
                                                                   Classify risk
                                                                         │
                                                                   Compute idempotency
                                                                         │
                                                                   INSERT events ──▶ Postgres
                                                                   INSERT snapshots ──▶ Postgres
                                                                         │
                                                              Realtime broadcasts ──▶ Dashboard
```

### Flow 2: Rollback Execution (Happy Path)

```
User       Dashboard        API           Celery          Gmail API       Database
─────────────────────────────────────────────────────────────────────────────────
Clicks       POST rollback
Rollback ──▶ /event_id/rollback
                  │
             Confirmation
             modal shown
                  │
User confirms     │
          ──▶ POST /rollback
                  │
             Create rollback
             record (pending)
                  │
             Enqueue Celery
             task (async) ──▶ Task picked up
                  │               │
             Return 202          Fetch event
             (accepted)          + snapshot
                                    │
                              GET oauth_token
                                    │
                              Call gmail.trash ──▶ Gmail API
                                    │              Returns 200
                              Update rollback ──────────────────▶ DB write
                              result = success
                                    │
                              Update event ──────────────────────▶ DB write
                              rollback_status = executed
                                    │
                              Realtime broadcasts UPDATE ──────────────────▶ Dashboard
                                                                             shows success ✓
```

---

## 13. Security Design

### Threat Model — STRIDE Analysis

| Threat Type | Example | Control |
|------------|---------|---------|
| **Spoofing** | Malicious extension impersonating Flight Recorder | Extension manifest is locked to our Chrome Web Store ID; JWT validates user identity |
| **Tampering** | User modifying their own event logs | Append-only table policy; no UPDATE/DELETE grant to app database user |
| **Repudiation** | Agent denying it took an action | Immutable event log with `content_hash` (SHA-256) per snapshot for integrity verification |
| **Information Disclosure** | Cross-user event access | RLS enforced at Postgres level — impossible to bypass via API |
| **Denial of Service** | Extension flooding /events with fake data | Rate limiting (60 req/min per user); Celery queue bounds rollback throughput |
| **Elevation of Privilege** | User accessing another user's connectors | RLS on connectors table; JWT user_id verified server-side on every request |

### OAuth Token Security

```
Storage:    Supabase Vault (AES-256 encrypted at rest)
Access:     Only backend service role key can decrypt
Exposure:   Never returned to frontend; backend uses and discards per request
Rotation:   Refresh token used automatically; re-auth flow on expiry
Revocation: User can disconnect app from Settings → deletes row from connectors table
```

### Content Security Policy (Extension)

```json
// manifest.json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'",
  "sandbox": "sandbox allow-scripts; script-src 'self'"
}
```

### API Security Headers (FastAPI)

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["flight-recorder-api.onrender.com"])
app.add_middleware(CORSMiddleware,
    allow_origins=["https://app.flightrecorder.ai", "chrome-extension://YOUR_EXTENSION_ID"],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# All responses include
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000
```

---

## 14. Observability & Monitoring

### What We Monitor

**Application layer (Sentry)**
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.environ['SENTRY_DSN'],
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,  # 10% of requests traced
    profiles_sample_rate=0.1
)

# Custom context for every event
with sentry_sdk.configure_scope() as scope:
    scope.set_tag("app", event.app)
    scope.set_tag("action_type", event.action_type)
```

**Key alerts to configure in Sentry:**
- Error rate > 5% on POST /events (5-minute window)
- Error rate > 20% on POST /rollback
- P95 latency > 1s on any endpoint
- Celery task failure rate > 10%

**Infrastructure (Render + Supabase dashboards)**
- Backend memory usage > 80% (512MB limit on free tier)
- Database storage > 400MB (approaching 500MB free limit)
- API response time degradation

**Business metrics (PostHog, free tier)**
```javascript
// Track key user actions in dashboard
posthog.capture('rollback_initiated', { app: 'gmail', event_id: id });
posthog.capture('rollback_success', { app: 'gmail', duration_ms: elapsed });
posthog.capture('diff_viewed', { app: 'gdocs' });
posthog.capture('extension_installed', {});
```

### Health Check Endpoint

```python
@app.get("/api/v1/health")
async def health():
    """Used by Render for health checks and uptime monitoring."""
    # Check DB connectivity
    db_ok = await check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "db": "connected" if db_ok else "disconnected"
    }
```

### Logging Strategy

```python
import structlog

logger = structlog.get_logger()

# Structured logging on every event ingest
logger.info("event_ingested",
    event_id=event_id,
    user_id=user_id,
    app=event.app,
    action_type=event.action_type,
    risk_level=risk_result.level,
    processing_time_ms=elapsed
)

# Structured logging on every rollback
logger.info("rollback_executed",
    rollback_id=rollback_id,
    event_id=event_id,
    app=app,
    result=result,
    duration_ms=elapsed,
    failure_reason=failure_reason
)
```

All logs are collected by Render's built-in log aggregation. No additional log service needed at MVP scale.
