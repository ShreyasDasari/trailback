# 06 — API Contracts
**Project:** Trailback
**Version:** 1.0
**Base URL:** `https://api.trailback.ai/api/v1`
**Auth:** `Authorization: Bearer <supabase_jwt>` on all endpoints except `/health`
**Last Updated:** February 2026

---

## 1. Conventions

- All timestamps: ISO 8601 UTC (`2026-02-23T14:30:00Z`)
- All IDs: UUID v4
- Content-Type: `application/json`
- Errors follow a consistent envelope (see §2)
- Pagination uses `limit` + `offset` query params

---

## 2. Error Envelope

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

### Standard Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Request body failed schema validation |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Authenticated but does not own this resource |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `DUPLICATE_EVENT` | Idempotency key already used |
| 422 | `ROLLBACK_UNAVAILABLE` | Rollback not possible (reason in details) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## 3. Events

### `POST /events` — Ingest an agent action

**Rate limit:** 60 req/min per user

**Request:**
```json
{
  "idempotency_key": "uuid-v4-from-extension",
  "agent_id": "claude-desktop-v1",
  "app": "gmail",
  "action_type": "email.send",
  "intent": "Sending follow-up to prospect about Q4 deal",
  "metadata": {
    "to": ["john@acme.com", "sarah@acme.com"],
    "subject": "Following up on Q4",
    "thread_id": "thread_abc123",
    "message_id": "msg_xyz456"
  },
  "before_snapshot": {
    "content": "Hi John, just following up on our conversation...",
    "content_type": "text/plain"
  },
  "after_snapshot": {
    "message_id": "msg_xyz456",
    "thread_id": "thread_abc123",
    "sent_at": "2026-02-23T14:30:00Z"
  }
}
```

**Response `201 Created`:**
```json
{
  "event_id": "evt_uuid",
  "risk_level": "medium",
  "risk_score": 35,
  "risk_reasons": ["Email sent to external domain", "2 recipients"],
  "rollback_status": "available",
  "created_at": "2026-02-23T14:30:01Z"
}
```

**Response `409 Conflict` (duplicate):**
```json
{
  "event_id": "evt_uuid_existing",
  "message": "Event already ingested with this idempotency key."
}
```

---

### `GET /timeline` — Paginated event feed

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 20 | Max 100 |
| `offset` | int | 0 | Pagination offset |
| `app` | string | all | `gmail` \| `gdocs` \| `slack` |
| `risk_level` | string | all | `low` \| `medium` \| `high` \| `critical` |
| `from` | ISO date | — | Start of date range |
| `to` | ISO date | — | End of date range |

**Response `200 OK`:**
```json
{
  "events": [
    {
      "id": "evt_uuid",
      "agent_id": "claude-desktop-v1",
      "app": "gmail",
      "action_type": "email.send",
      "intent": "Sending follow-up to prospect",
      "status": "completed",
      "risk_level": "medium",
      "risk_score": 35,
      "risk_reasons": ["Email sent to external domain"],
      "rollback_status": "available",
      "metadata": {
        "to": ["john@acme.com"],
        "subject": "Following up on Q4"
      },
      "created_at": "2026-02-23T14:30:01Z"
    }
  ],
  "total": 142,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```

---

### `GET /events/{event_id}` — Single event detail

**Response `200 OK`:**
```json
{
  "id": "evt_uuid",
  "agent_id": "claude-desktop-v1",
  "app": "gmail",
  "action_type": "email.send",
  "intent": "Sending follow-up to prospect",
  "status": "completed",
  "risk_level": "medium",
  "risk_score": 35,
  "risk_reasons": ["Email sent to external domain"],
  "rollback_status": "available",
  "metadata": { "to": ["john@acme.com"], "subject": "Following up on Q4" },
  "created_at": "2026-02-23T14:30:01Z",
  "updated_at": "2026-02-23T14:30:01Z"
}
```

---

### `GET /events/{event_id}/diff` — Before/after diff

**Response `200 OK`:**
```json
{
  "event_id": "evt_uuid",
  "app": "gdocs",
  "action_type": "doc.edit",
  "before": {
    "content": "The project timeline is on track for Q1.",
    "revision_id": "rev_001",
    "captured_at": "2026-02-23T14:30:00Z",
    "content_hash": "sha256_abc"
  },
  "after": {
    "content": "The project timeline is delayed to Q2 due to scope changes.",
    "revision_id": "rev_002",
    "captured_at": "2026-02-23T14:30:05Z",
    "content_hash": "sha256_def"
  },
  "diff": {
    "added": ["Q2 due to scope changes"],
    "removed": ["on track for Q1"],
    "change_count": 2
  },
  "rollback_available": true
}
```

**Response `404`** if event has no snapshots or diff is unavailable.

---

## 4. Rollbacks

### `POST /rollback/{event_id}` — Initiate rollback

**Rate limit:** 10 req/min per user

**Request:**
```json
{
  "confirmation": true,
  "reason": "Agent edited the wrong document section"
}
```

**Response `202 Accepted`:**
```json
{
  "rollback_id": "rb_uuid",
  "event_id": "evt_uuid",
  "status": "pending",
  "estimated_completion_ms": 3000
}
```

**Response `422 Unprocessable` (rollback unavailable):**
```json
{
  "error": {
    "code": "ROLLBACK_UNAVAILABLE",
    "message": "This Slack message is outside the 90-second deletion window.",
    "details": {
      "event_id": "evt_uuid",
      "reason_key": "slack_outside_window"
    }
  }
}
```

**Response `422` (already rolled back):**
```json
{
  "error": {
    "code": "ROLLBACK_UNAVAILABLE",
    "message": "This action has already been rolled back.",
    "details": { "rollback_status": "executed" }
  }
}
```

---

### `GET /rollback/{rollback_id}/status` — Poll rollback result

**Response `200 OK`:**
```json
{
  "rollback_id": "rb_uuid",
  "event_id": "evt_uuid",
  "result": "success",
  "failure_reason": null,
  "api_response": {
    "id": "msg_xyz456",
    "labelIds": ["TRASH"]
  },
  "executed_at": "2026-02-23T14:32:00Z"
}
```

**Possible `result` values:** `pending` | `success` | `failed` | `partial`

---

## 5. Connectors

### `GET /connectors` — List connected apps

**Response `200 OK`:**
```json
{
  "connectors": [
    {
      "app": "gmail",
      "is_active": true,
      "scopes": ["https://www.googleapis.com/auth/gmail.modify"],
      "connected_at": "2026-02-20T10:00:00Z",
      "last_used_at": "2026-02-23T14:30:01Z"
    },
    {
      "app": "gdocs",
      "is_active": true,
      "scopes": ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/documents"],
      "connected_at": "2026-02-20T10:01:00Z",
      "last_used_at": "2026-02-23T14:30:05Z"
    },
    {
      "app": "slack",
      "is_active": false,
      "scopes": null,
      "connected_at": null,
      "last_used_at": null
    }
  ]
}
```

### `DELETE /connectors/{app}` — Disconnect an app

**Response `204 No Content`** — connector record deleted, oauth token purged.

---

## 6. Agents

### `GET /agents` — List registered agents

**Response `200 OK`:**
```json
{
  "agents": [
    {
      "id": "agt_uuid",
      "name": "Claude Desktop",
      "agent_key": "redacted_shown_once",
      "total_actions": 247,
      "rolled_back": 3,
      "trust_score": 0.988,
      "created_at": "2026-02-10T09:00:00Z"
    }
  ]
}
```

### `POST /agents` — Register a new agent

**Request:**
```json
{ "name": "My Custom Agent" }
```

**Response `201 Created`:**
```json
{
  "id": "agt_uuid",
  "name": "My Custom Agent",
  "agent_key": "base64_key_shown_once_only",
  "trust_score": 1.0,
  "created_at": "2026-02-23T15:00:00Z"
}
```

> ⚠️ `agent_key` is shown **once only** at creation. Store it securely — it cannot be retrieved again.

---

## 7. Audit

### `GET /audit` — Full audit trail export (CSV)

**Query params:** `from` (ISO date), `to` (ISO date)

**Response `200 OK`:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="trailback-audit-2026-02.csv"

event_id,timestamp,agent_name,app,action_type,risk_level,rollback_status,metadata_summary
evt_uuid,2026-02-23T14:30:01Z,claude-desktop,gmail,email.send,medium,available,"To: john@acme.com | Subject: Following up on Q4"
```

---

## 8. Health

### `GET /health` — Health check (no auth required)

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-02-23T14:30:00Z",
  "db": "connected"
}
```

**Response `200 OK` (degraded):**
```json
{
  "status": "degraded",
  "version": "1.0.0",
  "timestamp": "2026-02-23T14:30:00Z",
  "db": "disconnected"
}
```

---

## 9. Rate Limits Summary

| Endpoint | Limit |
|----------|-------|
| `POST /events` | 60 req/min per user |
| `POST /rollback/*` | 10 req/min per user |
| `GET /timeline` | 120 req/min per user |
| `GET /events/*` | 120 req/min per user |
| All others | 60 req/min per user |

Rate limit headers returned on every response:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1740317460
```

---

## 10. Webhook Events (Post-MVP)

Reserved for v1.1 — outbound webhooks for team integrations:

```json
POST <user_webhook_url>
{
  "event": "trailback.event.critical",
  "payload": {
    "event_id": "evt_uuid",
    "risk_level": "critical",
    "app": "gmail",
    "action_type": "email.send",
    "metadata": { "to": [...], "subject": "..." }
  },
  "timestamp": "2026-02-23T14:30:01Z"
}
```
