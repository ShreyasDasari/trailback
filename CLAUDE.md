# CLAUDE.md — Trailback

## 1. PROJECT

Trailback is an AI agent governance, audit, and rollback platform that intercepts
every action an AI agent takes across Gmail, Google Docs, and Slack — capturing
before/after content snapshots, scoring risk, and enabling maximum-possible
reversal with full transparency.

Every agent action is recorded in an append-only event log in Supabase, enriched
with SHA-256-hashed before/after snapshots and a deterministic risk score, so
operators can see exactly what happened and undo it.

**Core moat:** Trailback owns the before/after content snapshot and its integrity
hash — this never routes through any third-party. It lives only in Supabase.

---

## 2. ARCHITECTURE

```
User / AI agent SDK
        │  POST /api/v1/events  (JWT required)
        ▼
┌──────────────────────┐
│  FastAPI backend      │  apps/backend/main.py
│  - Risk classifier    │  core/risk_classifier.py
│  - JWT validation     │  api/deps.py
│  - SHA-256 hashing    │  (inline in main.py)
└────────┬─────────────┘
         │  supabase-py (SERVICE_KEY — bypasses RLS)
         ▼
┌─────────────────────────────────────────────────┐
│  Supabase (PostgreSQL 15)                        │
│  events · snapshots · rollbacks · connectors     │
│  agents  · RLS on all tables · Realtime          │
└────────┬────────────────────────────────────────┘
         │  Celery task (execute_rollback)
         ▼
┌──────────────────────┐
│  Upstash Redis        │  broker + result backend
└────────┬─────────────┘
         │  connector functions (to be replaced by Composio in Phase 4)
         ▼
┌─────────────────────────────────────────────────┐
│  Real tool APIs                                  │
│  Gmail API · Google Drive API · Slack API        │
└─────────────────────────────────────────────────┘

Next.js frontend (repo root)
  lib/api.ts → FastAPI backend   (Bearer JWT from Supabase session)
  lib/supabase/client.ts → Supabase  (ANON_KEY + RLS)
  Supabase Realtime → timeline page  (INSERT/UPDATE events per user_id)
```

---

## 3. TECH STACK

### Backend — apps/backend/requirements.txt
```
fastapi==0.134.0
uvicorn==0.41.0
pydantic==2.12.5
supabase==2.28.0
celery==5.4.0
redis==5.2.1
httpx==0.28.1
python-dotenv==1.2.1
PyJWT==2.11.0
```
Runtime: Python 3.12. Full pinned list in apps/backend/requirements.txt.

### Frontend — package.json
```
next==15.2.6
react==19.0.0
react-dom==19.0.0
typescript==5.7.3
tailwindcss==3.4.17
framer-motion==12.0.0
@supabase/supabase-js==2.49.1
@supabase/ssr==0.5.2
@upstash/redis==1.34.3
lucide-react==0.469.0
swr==2.3.3
date-fns==4.1.0
react-diff-viewer-continued==4.0.5
class-variance-authority==0.7.1
clsx==2.1.1
tailwind-merge==2.6.0
tailwindcss-animate==1.0.7
```
All @radix-ui/* components at ^1.x–^2.x (see package.json).

---

## 4. DIRECTORY MAP

```
/                                   repo root
├── app/                            Next.js App Router pages
│   ├── (dashboard)/                route group — protected by middleware
│   │   ├── event/[id]/diff/        before/after diff view
│   │   ├── event/[id]/rollback/    rollback confirmation + status
│   │   ├── layout.tsx              dashboard shell (sidebar + auth gate)
│   │   ├── settings/agents/        agent registry page
│   │   ├── settings/connectors/    OAuth connector management
│   │   └── timeline/               real-time event feed (main view)
│   ├── auth/
│   │   ├── callback/route.ts       OAuth code → session exchange
│   │   ├── error/page.tsx          human-readable auth error page
│   │   └── success/page.tsx        extension session relay page (archived flow)
│   ├── login/page.tsx              Google sign-in — single button
│   ├── page.tsx                    public landing / redirect
│   ├── globals.css                 Tailwind base + CSS variables
│   └── layout.tsx                  root layout
├── components/                     shared UI components
│   ├── event-card.tsx              timeline event row + skeleton
│   ├── filter-bar.tsx              app/risk/date filter controls
│   ├── risk-badge.tsx              color-coded risk level pill
│   ├── rollback-modal.tsx          confirmation modal + status polling
│   ├── sidebar.tsx                 nav sidebar with user profile row
│   ├── app-icon.tsx                per-app icon (gmail/gdocs/slack)
│   └── trailback-logo.tsx          SVG logo component
├── lib/
│   ├── api.ts                      typed fetch client for FastAPI backend
│   ├── redis.ts                    Upstash Redis client (frontend)
│   ├── supabase/client.ts          browser Supabase client
│   ├── supabase/server.ts          server-side Supabase client
│   ├── supabase/middleware.ts      session refresh + route protection
│   ├── types.ts                    all TypeScript interfaces + enums
│   └── utils.ts                    cn(), formatDate(), etc.
├── middleware.ts                   delegates to lib/supabase/middleware.ts
├── scripts/add-rls-policies.sql   one-off RLS setup script
├── next.config.ts                  empty Next.js config
├── vercel.json                     framework=nextjs, buildCommand=pnpm build
├── package.json                    frontend deps
├── pnpm-lock.yaml                  lockfile — use pnpm, not npm
├── tailwind.config.ts
├── tsconfig.json
│
├── apps/
│   ├── backend/                    FastAPI backend (deployed on Render)
│   │   ├── main.py                 all API routes
│   │   ├── api/deps.py             get_current_user() JWT dependency
│   │   ├── core/risk_classifier.py 7-rule deterministic risk engine
│   │   ├── connectors/
│   │   │   ├── gmail.py            trash_email() — httpx to Gmail API
│   │   │   ├── gdocs.py            restore_revision() — Drive API PATCH
│   │   │   └── slack.py            delete_message() — chat.delete API
│   │   ├── db/supabase_client.py   singleton supabase client (SERVICE_KEY)
│   │   ├── models/event.py         EventPayload + SnapshotPayload (Pydantic v2)
│   │   ├── workers/
│   │   │   ├── celery_app.py       Celery config (Upstash Redis broker)
│   │   │   └── tasks.py            execute_rollback task (3-retry backoff)
│   │   ├── tests/
│   │   │   ├── unit/test_risk_classifier.py   21 tests
│   │   │   ├── unit/test_gdocs_connector.py   3 tests
│   │   │   ├── unit/test_slack_connector.py   4 tests
│   │   │   ├── integration/test_events_api.py (needs live DB)
│   │   │   └── integration/test_rollback_api.py
│   │   ├── conftest.py             sys.path insert for pytest
│   │   ├── .env.example            env var template
│   │   └── requirements.txt        pinned Python deps
│   │
│   └── extension/                  ARCHIVED — Chrome extension, do not touch
│
├── supabase/
│   └── migrations/                 run against Supabase project in order
│       ├── 001_extensions.sql      pgcrypto
│       ├── 002_core_tables.sql     events, snapshots, rollbacks, connectors, agents
│       ├── 003_indexes.sql         performance indexes
│       ├── 004_rls.sql             row level security policies
│       ├── 005_realtime.sql        enable realtime on events + rollbacks
│       └── 006_updated_at_trigger.sql  auto-update updated_at
│
└── docs/                           engineering specs (do not edit)
```

---

## 5. ENV VARS

### Frontend (.env.local at repo root)
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **required** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **required** | Supabase anon/public key |
| `NEXT_PUBLIC_API_URL` | **required** | FastAPI backend URL (e.g. https://trailback.onrender.com) |
| `COMPOSIO_API_KEY` | optional | Composio API key (Phase 4 — not yet used in code) |

### Backend (apps/backend/.env)
| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | **required** | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | **required** | Service role key — bypasses RLS. Never expose to frontend. |
| `UPSTASH_REDIS_URL` | **required** | redis:// connection string from Upstash console |
| `ENVIRONMENT` | optional | `development` or `production` |
| `SUPABASE_ANON_KEY` | optional | Listed in .env.example but not used by current code |

---

## 6. DEV COMMANDS

```bash
# Frontend (Next.js — port 3000)
pnpm dev                         # runs with turbopack

# Backend (FastAPI — port 8000)
cd apps/backend
uvicorn main:app --reload --port 8000

# Celery worker (required for rollback execution)
cd apps/backend
celery -A workers.celery_app worker --loglevel=info

# Unit tests (no live DB required)
cd apps/backend
python -m pytest tests/unit/ -v

# Integration tests (requires live Supabase + .env)
cd apps/backend
python -m pytest tests/integration/ -v
```

---

## 7. DATABASE SCHEMA

### Table: events (append-only — never UPDATE content, never DELETE)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| user_id | UUID FK → auth.users | |
| agent_id | TEXT | default 'unknown' |
| app | TEXT | CHECK: gmail, gdocs, slack |
| action_type | TEXT | e.g. email.send, doc.edit, message.post |
| intent | TEXT | nullable |
| status | TEXT | completed, rolled_back, partial, failed |
| risk_level | TEXT | low, medium, high, critical |
| risk_score | INTEGER | 0–100 |
| risk_reasons | TEXT[] | human-readable explanations |
| rollback_status | TEXT | available, executed, unavailable, failed |
| idempotency_key | TEXT | UNIQUE, nullable |
| metadata | JSONB | app-specific (to, subject, channel, ts, file_id, …) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | auto-updated by trigger 006 |

### Table: snapshots
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK → events | |
| snapshot_type | TEXT | CHECK: before, after |
| content | JSONB | full content blob |
| content_hash | TEXT | SHA-256 of JSON-serialized content |
| captured_at | TIMESTAMPTZ | |

### Table: rollbacks
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK → events | |
| user_id | UUID FK → auth.users | |
| initiated_by | TEXT | default 'user' |
| result | TEXT | pending, success, failed, partial |
| failure_reason | TEXT | nullable |
| api_response | JSONB | raw connector response |
| executed_at | TIMESTAMPTZ | |

### Table: connectors
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → auth.users | |
| app | TEXT | CHECK: gmail, gdocs, slack |
| oauth_token | TEXT | store encrypted; never return to frontend |
| refresh_token | TEXT | nullable |
| scopes | TEXT[] | nullable |
| is_active | BOOLEAN | default TRUE |
| connected_at | TIMESTAMPTZ | |
| last_used_at | TIMESTAMPTZ | nullable |
| UNIQUE | (user_id, app) | one active connection per user per app |

### Table: agents
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → auth.users | |
| name | TEXT | |
| agent_key | TEXT | UNIQUE, random base64 (24 bytes) |
| total_actions | INTEGER | default 0 |
| rolled_back | INTEGER | default 0 |
| trust_score | FLOAT | 0.0–1.0; trust_score = 1 - (rolled_back / total_actions) |
| created_at | TIMESTAMPTZ | |

### RLS Policies
- `events`: FOR ALL USING (auth.uid() = user_id)
- `snapshots`: FOR ALL USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()))
- `rollbacks`: FOR ALL USING (user_id = auth.uid())
- `connectors`: FOR ALL USING (user_id = auth.uid())
- `agents`: FOR ALL USING (user_id = auth.uid())
- Backend uses SUPABASE_SERVICE_KEY which bypasses RLS entirely.

---

## 8. API ENDPOINTS

All protected endpoints require `Authorization: Bearer <supabase_jwt>`.
JWT validated via `supabase.auth.get_user(token)` — returns 401 on failure.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/health | no | DB ping + version |
| POST | /api/v1/events | yes | Ingest agent action. Idempotency check → risk classify → insert event + snapshots. Returns 409 on duplicate key. |
| GET | /api/v1/timeline | yes | Paginated event feed. Query params: limit, offset, app, risk_level, from_date, to_date. |
| GET | /api/v1/events/{event_id} | yes | Single event detail. |
| GET | /api/v1/events/{event_id}/diff | yes | Event + before/after snapshots with hashes. |
| POST | /api/v1/rollback/{event_id} | yes | Initiate rollback. Body: {confirmation: true, reason?}. Returns 202, dispatches Celery task. |
| GET | /api/v1/rollback/{rollback_id}/status | yes | Poll rollback result (pending/success/failed). |
| GET | /api/v1/connectors | yes | List connected apps for user (gmail/gdocs/slack). |
| DELETE | /api/v1/connectors/{app} | yes | Disconnect an app (deletes connector row). |
| POST | /api/v1/connectors/upsert | yes | Store OAuth token after connect flow. Body: {app, oauth_token, refresh_token?, scopes?}. |
| GET | /api/v1/agents | yes | List registered agents for user. |
| POST | /api/v1/agents | yes | Register new agent. Body: {name}. Returns agent_key. |
| GET | /api/v1/audit | yes | CSV export of all events. Query params: from_date, to_date. |

---

## 9. CODING RULES

### Naming
- Python: snake_case for all variables, functions, modules
- TypeScript: camelCase for variables/functions, PascalCase for components/types
- Supabase table names: snake_case
- API paths: kebab-case (/api/v1/rollback/{id}/status)

### Error handling
- FastAPI: `raise HTTPException(status_code=..., detail=...)` — detail can be string or dict
- Structured error dicts always include `code` and `message` keys (e.g. DUPLICATE_EVENT, ROLLBACK_UNAVAILABLE)
- Connector functions return `{"success": bool, ...}` — never raise, always return a dict
- Frontend: `ApiError(status, code, message)` thrown by `apiFetch()` on non-2xx

### Async patterns
- FastAPI route handlers are `async def`
- Connectors use `httpx.AsyncClient()` with `async with` context manager
- Celery tasks are sync — async calls wrapped in `_run_async()` helper (tasks.py)
- Frontend: `useCallback` + `useEffect` for data fetching

### Comments
- Only when the WHY is non-obvious (e.g. "Do NOT rely on provider_token — Google omits it on re-consent")
- No docstrings on simple functions
- No task/PR references in code comments

### Function length
- Keep under 40 lines, single responsibility
- `tasks.py::execute_rollback` is the intentional exception (~90 lines) due to its sequential step structure

### Supabase queries
- Backend: always chain `.eq("user_id", user_id)` for ownership. Never trust URL params alone.
- Never `SELECT *` without a user_id filter on multi-tenant tables.

---

## 10. WHAT TRAILBACK OWNS (never delegate to Composio)

- **Before snapshot capture**: at intercept time, before action fires, stored in `snapshots` table
- **After snapshot capture**: from action response, stored in `snapshots` table
- **SHA-256 content hash**: `hashlib.sha256(json.dumps(content).encode()).hexdigest()` — in-process, stored with snapshot
- **Risk classification**: 7-rule deterministic engine in `core/risk_classifier.py` — no LLM, no external call, <5ms
- **Rollback registry**: `rollbacks` table — append-only record of every attempt and result
- **Rollback status tracking**: `events.rollback_status` (available → executed/failed)
- **Audit trail**: `events` is append-only. Rollbacks INSERT a compensating event row; they never UPDATE original content
- **Trust score per agent**: `trust_score = 1 - (rolled_back / total_actions)`, recomputed on each rollback

---

## 11. WHAT COMPOSIO OWNS (Phase 4 — not yet integrated)

- OAuth token storage and refresh for all connectors (Gmail, Docs, Slack, GitHub, Notion, …)
- Tool execution — the actual API call to the 3rd-party service
- Retries and rate limiting
- `connected_accounts.link()` for generating the OAuth redirect URL for onboarding
- **NOTE**: `connected_accounts.initiate()` is **retired as of 2026-05-08** for Composio-managed OAuth on new orgs. Always use `connected_accounts.link()`.

---

## 12. ROLLBACK STATES

| State | Meaning | Examples |
|---|---|---|
| **FULL** | API undo exists, no time constraint | Google Docs revision restore, delete a created calendar event |
| **PARTIAL** | Reversed on Trailback's end; recipient may have seen it | Sent email moved to trash (Gmail), Slack message deleted (within 24h window) |
| **ACKNOWLEDGED** | Irreversible broadcast — record only, no API reversal | Mass email to 50+ recipients, public Slack announcement |

---

## 13. COMPLETED PHASES

- Phase 0 (2026-06-05): Branch audit — squash-merged `shreyas` into `main`. All branches consolidated.
- Phase 1 (2026-06-05): FastAPI backend, risk classifier, Celery rollback, hand-written connectors, Supabase migrations 001–006 merged and tested (25/25 unit tests passing).
- Phase 2 (2026-06-05): CLAUDE.md written from full repo read.
- Phase 3 (2026-06-05): Auth hardened — login error display, new-user → /onboarding routing, error page ?reason= param, landing page dead-code removed, CORS cleaned, /auth/success neutralised, 12 auth tests added (37/37 passing).

---

## 14. DO NOT DO

- Do not touch `apps/extension/` — it is archived, not the product
- Do not add the Chrome extension to any new user-facing flow
- Do not route snapshot content through Composio — snapshots live only in Supabase
- Do not use `composio.connected_accounts.initiate()` — it is retired; use `connected_accounts.link()`
- Do not write per-connector rollback code — use the rollback profile table approach (Phase 4)
- Do not hardcode credentials — all secrets via `os.environ`
- Do not UPDATE or DELETE from the `events` or `snapshots` tables — they are append-only
- Do not return OAuth tokens or the Supabase SERVICE_KEY to the frontend under any circumstances
- Do not use `npm install` — this repo uses pnpm (`pnpm-lock.yaml` is the lockfile)
- Do not skip the ownership check: every backend Supabase query must `.eq("user_id", user_id)`
- Do not add the Chrome extension CORS origin to new features — it belongs to the archived extension
