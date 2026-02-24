# 10 — Development Phases
**Project:** Trailback
**MVP Timeline:** 6 Weeks
**Developer:** Solo student developer
**Last Updated:** February 2026

---

## Overview

```
Week 1 ──▶ Foundation & Infrastructure
Week 2 ──▶ Core Recording (Gmail + Docs)
Week 3 ──▶ Dashboard MVP (Timeline + Auth)
Week 4 ──▶ Rollback Engine
Week 5 ──▶ Slack + Polish
Week 6 ──▶ Launch Prep + Deploy
─────────────────────────────────────────
Post-MVP v1.1  ──▶ Team features + Notion
Post-MVP v1.2  ──▶ Calendar + Alerts
Post-MVP v2.0  ──▶ AI enrichment + Policies
```

---

## Phase 1 — Foundation & Infrastructure (Week 1)

**Goal:** All infrastructure is running. You can write to the database and read from it. No UI yet.

### Backend Tasks
- [ ] Initialise `apps/backend` with FastAPI scaffold (`main.py`, `api/`, `models/`, `db/`)
- [ ] Install all Python dependencies (`requirements.txt`)
- [ ] Configure `.env` with Supabase URL + service key, Upstash Redis URL
- [ ] Implement `db/supabase_client.py` with Supabase Python client
- [ ] Implement `GET /health` endpoint with DB ping
- [ ] Implement JWT auth dependency (`api/deps.py`) using Supabase public key
- [ ] Run backend locally: `uvicorn main:app --reload`

### Database Tasks
- [ ] Create Supabase project
- [ ] Run Migration 001 (pgcrypto extension)
- [ ] Run Migration 002 (all 5 tables)
- [ ] Run Migration 003 (all indexes)
- [ ] Run Migration 004 (RLS policies)
- [ ] Run Migration 005 (Realtime publication)
- [ ] Run Migration 006 (updated_at trigger)
- [ ] Verify RLS: confirm cross-user queries return empty results

### Monorepo Tasks
- [ ] Initialise monorepo: `pnpm init`, `turbo init`
- [ ] Create `packages/types/src/events.ts` with core TypeScript types
- [ ] Configure `turbo.json` pipeline
- [ ] Set up `.gitignore` (include `venv/`, `.env`, `.next/`, `node_modules/`)
- [ ] Create root `README.md`

### Validation Criteria
- `GET /health` returns `{"status": "healthy"}` ✅
- Database schema visible in Supabase dashboard ✅
- `pnpm dev` launches without errors ✅

---

## Phase 2 — Core Recording (Week 2)

**Goal:** Gmail sends and Google Docs edits are captured and appear in the database. No UI yet — validate via Supabase table view.

### Backend Tasks
- [ ] Implement Pydantic schemas (`models/event.py`)
- [ ] Implement `POST /events` endpoint with:
  - JWT validation
  - Pydantic schema validation
  - Idempotency key check
  - Risk classifier call (`core/risk_classifier.py`)
  - Diff computation for Docs events (`deepdiff`)
  - INSERT into `events` + `snapshots`
  - Return `event_id`, `risk_level`, `rollback_status`
- [ ] Implement full risk classifier (all 7 rule groups from doc-08)
- [ ] Write unit tests for all 7 rule groups

### Chrome Extension Tasks
- [ ] Initialise `apps/extension` with `manifest.json`
- [ ] Implement `background/service-worker.js`:
  - `chrome.storage.local` event queue
  - `chrome.alarms` flush every 30s
  - POST to backend with JWT
- [ ] Implement Gmail interceptor (`content-scripts/gmail-interceptor.js`):
  - Inject `fetch-hook.js` into MAIN world
  - Detect `gmail.googleapis.com/.../send` calls
  - Capture before snapshot (draft body) + after snapshot (message_id)
  - Send to service worker via `chrome.runtime.sendMessage`
- [ ] Implement Docs interceptor (`content-scripts/docs-interceptor.js`):
  - Detect Drive save / auto-save API calls
  - Capture before revision ID + after revision ID
- [ ] Test end-to-end: agent sends Gmail → event appears in Supabase `events` table

### Validation Criteria
- Gmail send captured in DB with correct metadata ✅
- Docs edit captured with before/after revision IDs ✅
- Risk score correctly assigned ✅
- Duplicate event (same idempotency key) returns 409, not duplicate row ✅
- If backend is down, event stays in `chrome.storage` and syncs on reconnect ✅

---

## Phase 3 — Dashboard MVP (Week 3)

**Goal:** Users can sign in with Google, see their events in real-time, and view the diff for any Docs event.

### Frontend Tasks
- [ ] Initialise `apps/web` with Next.js 14 + Tailwind + shadcn/ui
- [ ] Configure Supabase browser client (`lib/supabase.ts`) + server client (`lib/supabase-server.ts`)
- [ ] Implement Google OAuth login page (`app/(auth)/login/page.tsx`)
- [ ] Implement auth guard middleware (redirect unauthenticated to `/login`)
- [ ] Implement `GET /timeline` backend endpoint with pagination + filters
- [ ] Implement `useTimeline` hook with Supabase Realtime subscription
- [ ] Build `EventCard` component with:
  - App icon (`AppIcon.tsx`)
  - Plain-English action description
  - Time ago (relative)
  - `RiskBadge` component (colour-coded, with tooltip reasons)
  - Rollback button (disabled state for now)
- [ ] Build Timeline page with `EventFeed` (infinite scroll) + `FilterBar`
- [ ] Implement `GET /events/:id/diff` backend endpoint
- [ ] Build `DiffViewer` using `react-diff-viewer-continued`
- [ ] Build Diff page (`app/event/[id]/diff/page.tsx`)

### Validation Criteria
- Sign in with Google works ✅
- Timeline shows events in real-time without refresh ✅
- Filter by app narrows the feed correctly ✅
- Diff view shows correct before/after for Docs events ✅
- RLS confirmed: user A cannot see user B's events ✅

---

## Phase 4 — Rollback Engine (Week 4)

**Goal:** Gmail rollback and Google Docs rollback work end-to-end. User can roll back an action from the dashboard.

### Backend Tasks
- [ ] Implement Gmail rollback connector (`connectors/gmail.py`):
  - `messages.trash(message_id)` via Google API
  - OAuth token retrieval from `connectors` table
- [ ] Implement Google Docs rollback connector (`connectors/gdocs.py`):
  - `revisions.restore(file_id, revision_id)` via Drive API
- [ ] Implement Celery app config (`workers/celery_app.py`) with Upstash Redis broker
- [ ] Implement `execute_rollback` Celery task (`workers/tasks.py`):
  - Fetch event + snapshots
  - Decrypt OAuth token
  - Call connector
  - UPDATE rollbacks + events tables
  - 3 retries with exponential backoff
- [ ] Implement `POST /rollback/:id` endpoint:
  - Validate JWT + ownership
  - Check `rollback_status == "available"`
  - Create rollback record (status: "pending")
  - Enqueue Celery task
  - Return 202 + rollback_id
- [ ] Implement `GET /rollback/:id/status` endpoint

### Frontend Tasks
- [ ] Build `RollbackModal` component (two-step confirm with plain-English description)
- [ ] Build `RollbackStatus` component (Queued → In Progress → Success/Failed)
- [ ] Implement `useRollback` hook (POST + status polling)
- [ ] Wire Rollback button in `EventCard` and `DiffPage`
- [ ] Build rollback confirmation page (`app/event/[id]/rollback/page.tsx`)

### Validation Criteria
- Gmail rollback moves email to trash within 5 seconds ✅
- Docs rollback restores prior revision ✅
- `rollback_status` updates to "executed" in UI without refresh ✅
- Rollback button permanently disabled after success ✅
- Failed rollback shows plain-English error reason ✅

---

## Phase 5 — Slack + Polish (Week 5)

**Goal:** Slack is fully integrated. All error states, empty states, and settings are complete. The product is demo-ready.

### Backend Tasks
- [ ] Implement Slack interceptor (`content-scripts/slack-interceptor.js`)
- [ ] Implement Slack rollback connector (`connectors/slack.py`):
  - `chat.delete(channel, ts)` via Slack Web API
  - Handle `msg_too_old` error gracefully
- [ ] Implement `GET /connectors`, `DELETE /connectors/:app`
- [ ] Implement `GET/POST /agents`
- [ ] Implement `GET /audit` (CSV export)

### Frontend Tasks
- [ ] Build Settings page — Connectors (`ConnectorCard` per app)
- [ ] Build Settings page — Agents (`AgentCard` with trust score)
- [ ] Build Audit page with date range picker + CSV export
- [ ] Implement all empty states (see doc-03)
- [ ] Implement all error states (see doc-03):
  - Backend offline banner
  - OAuth expired connector card
  - Rollback failed inline error
  - Extension not installed banner
- [ ] Implement responsive layout (mobile bottom nav, collapsed sidebar)
- [ ] Extension popup: complete with status dot, connected apps strip, last event

### Validation Criteria
- Slack message captured and appears in timeline ✅
- Slack rollback deletes message (within window) ✅
- Slack rollback shows clear error when outside window ✅
- All empty and error states verified manually ✅
- Dashboard works on mobile (1-column layout) ✅

---

## Phase 6 — Launch Prep (Week 6)

**Goal:** The product is deployed, monitored, and ready for first users.

### Infrastructure Tasks
- [ ] Configure GitHub Actions CI pipeline (`ci.yml`):
  - Run `pytest` on backend
  - Run `pnpm lint` + `pnpm type-check` on frontend
  - Runs on every PR + push to main
- [ ] Configure GitHub Actions deploy workflows:
  - `deploy-web.yml`: Vercel production deploy on merge to main
  - `deploy-backend.yml`: Render deploy hook on merge to main
- [ ] Set up keep-alive cron (ping `/health` every 14 min via GitHub Actions)
- [ ] Add all environment variables to Vercel dashboard
- [ ] Add all environment variables to Render dashboard
- [ ] Configure Sentry for backend + frontend

### Chrome Extension Tasks
- [ ] Build production zip: `zip -r trailback-extension.zip apps/extension/`
- [ ] Submit to Chrome Web Store (or load unpacked for beta)
- [ ] Test extension on fresh Chrome profile (no cached auth)

### Quality Tasks
- [ ] Complete manual QA checklist (see doc-12)
- [ ] Fix all P0 bugs found during QA
- [ ] Verify Sentry receives errors from both frontend and backend
- [ ] Test Render cold start: confirm event queue absorbs events correctly

### Documentation Tasks
- [ ] Write public `README.md` with setup instructions
- [ ] Write `CONTRIBUTING.md`
- [ ] Publish all 12 docs to `/docs` folder in repo

### Validation Criteria
- All 12 acceptance criteria from QA checklist pass ✅
- Zero P0 bugs open ✅
- Sentry connected and receiving events ✅
- Extension submittable to Chrome Web Store ✅
- First external user can install + use Trailback without help ✅

---

## Post-MVP Roadmap

### v1.1 (Month 2–3)
- Notion connector (read + rollback doc edits)
- Team accounts (shared timeline, 3 users, invite flow)
- CSV/PDF audit trail export with branding
- 30-day log retention enforcement on free tier

### v1.2 (Month 4–5)
- Jira connector (log and rollback issue updates)
- Google Calendar connector
- Automated risk alerts (email/Slack on CRITICAL events)
- Agent trust score dashboard + history chart

### v2.0 (Month 6–9)
- LLM-powered action summaries (Gemini Flash, async, optional)
- Automated rollback policies (auto-rollback above configurable threshold)
- Developer API (programmatic event querying)
- Firefox extension support

### v3.0 (Month 12+)
- Desktop agent integration (non-browser agents)
- SOC 2 Type 2 certification
- SSO / SAML for enterprise
- SCIM provisioning
