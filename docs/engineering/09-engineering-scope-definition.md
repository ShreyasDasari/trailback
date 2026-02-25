# 09 — Engineering Scope Definition
**Project:** Trailback
**Version:** 1.0
**Last Updated:** February 2026

---

## 1. Purpose

This document defines exactly what will be built, what will not be built, and the technical boundaries for each component during the MVP phase. It serves as the engineering team's contract for scope — preventing scope creep and ensuring every feature decision is intentional.

---

## 2. In Scope — MVP (Weeks 1–6)

### 2.1 Chrome Extension

| Feature | In Scope | Notes |
|---------|----------|-------|
| Gmail send interception | ✅ | Via `window.fetch` hook in main world |
| Google Docs edit interception | ✅ | Via Drive API auto-save detection |
| Slack message post interception | ✅ | Via `chat.postMessage` detection |
| Service worker event queue | ✅ | `chrome.storage.local` + alarm-based flush |
| Google OAuth token acquisition | ✅ | Via `chrome.identity` API |
| Extension popup (status + dashboard link) | ✅ | Minimal HTML/JS |
| Idempotency key generation | ✅ | UUID v4 per event |
| Chrome only (MV3) | ✅ | Chromium 118+ |

### 2.2 FastAPI Backend

| Feature | In Scope | Notes |
|---------|----------|-------|
| POST /events (ingest) | ✅ | With idempotency, validation, risk scoring |
| GET /timeline (paginated) | ✅ | With app + risk + date filters |
| GET /events/:id | ✅ | Single event detail |
| GET /events/:id/diff | ✅ | Before/after diff computation |
| POST /rollback/:id | ✅ | Async via Celery |
| GET /rollback/:id/status | ✅ | Poll rollback result |
| GET/DELETE /connectors | ✅ | List and disconnect apps |
| GET/POST /agents | ✅ | Register agents, retrieve agent_key |
| GET /audit (CSV export) | ✅ | Date-range filtered CSV download |
| GET /health | ✅ | DB ping health check |
| JWT auth via Supabase | ✅ | All endpoints except /health |
| Risk classification engine | ✅ | Rule-based, 7 rule groups |
| Gmail rollback connector | ✅ | `messages.trash` |
| Google Docs rollback connector | ✅ | `revisions.restore` |
| Slack rollback connector | ✅ | `chat.delete` |
| Celery + Upstash async jobs | ✅ | 3 retries with exponential backoff |
| Rate limiting | ✅ | Per-user, via Redis counter |
| Sentry error tracking | ✅ | `sentry-sdk[fastapi]` |

### 2.3 Database (Supabase)

| Feature | In Scope | Notes |
|---------|----------|-------|
| `events` table | ✅ | Append-only |
| `snapshots` table | ✅ | Before + after per event |
| `rollbacks` table | ✅ | Full rollback history |
| `connectors` table | ✅ | Per-user OAuth state |
| `agents` table | ✅ | Trust score tracking |
| Row Level Security (RLS) | ✅ | All tables |
| Realtime publication | ✅ | events + rollbacks tables |
| OAuth token encryption | ✅ | Supabase Vault |
| 7-day retention cron | ✅ | Supabase Edge Function |
| Indexes (all defined patterns) | ✅ | See doc-05 |

### 2.4 Next.js Dashboard

| Feature | In Scope | Notes |
|---------|----------|-------|
| Google OAuth login page | ✅ | Supabase Auth |
| Timeline page (real-time) | ✅ | Supabase Realtime |
| Filter bar (app, risk, date) | ✅ | Client-side filter state |
| EventCard component | ✅ | With risk badge, rollback button |
| Diff view page | ✅ | `react-diff-viewer-continued` |
| Rollback confirmation modal | ✅ | Two-step confirm |
| Rollback status display | ✅ | Queued → In Progress → Success/Failed |
| Audit trail page + CSV export | ✅ | Date range picker |
| Settings — Connector management | ✅ | Connect/disconnect per app |
| Settings — Agent registry | ✅ | Register agent, view trust score |
| Empty states (all pages) | ✅ | See doc-03 |
| Error states (all scenarios) | ✅ | See doc-03 |
| Responsive design | ✅ | Desktop-first, mobile-aware |
| WCAG 2.1 AA | ✅ | Colour contrast + keyboard nav |

---

## 3. Out of Scope — MVP

These items are explicitly deferred. Any work on them during the MVP phase requires a scope change decision.

### 3.1 Features Deferred to v1.1

| Item | Reason |
|------|--------|
| Team/multi-user workspaces | Requires org/workspace DB model, RBAC, shared timeline |
| Shared audit trail across users | Depends on team feature |
| Notion connector | Lower user priority in research; build after core 3 connectors proven |
| Jira connector | Same as above |
| Google Calendar connector | Post-MVP surface area |
| 30-day log retention on free tier | Requires billing enforcement |
| Automated rollback policies | Requires rule engine + policy management UI |
| Webhook outbound notifications | Requires webhook endpoint management |

### 3.2 Technical Debt Deferred

| Item | Reason |
|------|--------|
| LLM-powered intent summarisation | Non-deterministic, adds latency, costs money — v3 feature |
| OpenTelemetry distributed tracing | Over-engineered for MVP scale |
| Redis response caching | Not needed at MVP scale (< 500 users) |
| Database connection pooling (PgBouncer) | Supabase handles pooling internally |
| Custom domain (`trailback.ai`) | Nice-to-have, not required for MVP |
| Stripe billing integration | No paid tiers until product-market fit |

### 3.3 Browser Support

| Browser | Status |
|---------|--------|
| Chrome / Chromium 118+ | ✅ MVP |
| Edge (Chromium) | ⏳ Easy port, post-MVP |
| Firefox | ⏳ Requires MV2 → MV3 differences |
| Safari | ❌ Different extension platform entirely |
| Mobile browsers | ❌ No extension support |

---

## 4. Technical Constraints & Decisions

### 4.1 All-Free Stack Constraint

Every component must have a permanent, always-available free tier. If a service introduces paid-only requirements, it must be replaced. Current zero-cost commitment:

| Service | Free Tier Used | Limit |
|---------|---------------|-------|
| Supabase | Free forever | 500MB DB, 50K MAU |
| Vercel | Hobby (free) | 100GB bandwidth |
| Render | Free web service | Spins down after 15min |
| Upstash | Free Redis | 10K commands/day |
| GitHub Actions | Free (public repo) | 2,000 min/month |

### 4.2 Cold Start Handling (Render free tier)

Render's free tier spins down after 15 minutes of inactivity. Cold start takes 30–60 seconds. Mitigation strategies:

1. **Extension queue absorbs events during cold start.** Events are held in `chrome.storage` and flushed when the backend is back.
2. **Health check ping.** A GitHub Actions cron pings `/health` every 14 minutes to keep the service warm (free, uses 0 build minutes).
3. **User-facing indicator.** Dashboard shows a "Connecting..." spinner if the backend takes > 3s to respond, instead of an error.

### 4.3 Single Developer Constraints

The architecture must be operable without:
- A DevOps or infrastructure engineer
- Any paid monitoring or alerting (Sentry free tier only)
- Manual database maintenance (all handled by Supabase)
- Custom Dockerfiles or Kubernetes

---

## 5. Definition of Done

A feature is considered **done** when:

- [ ] Code is merged to `main` via PR
- [ ] All relevant unit tests pass (coverage ≥ 80% for new code)
- [ ] Integration test for the happy path passes
- [ ] Sentry is not reporting new errors from the feature
- [ ] The feature works end-to-end in the staging environment (Vercel preview + Render)
- [ ] Relevant acceptance criteria from doc-02 are verified manually
- [ ] No regressions in existing tests

---

## 6. Feature Flag Strategy

For features that straddle the MVP/post-MVP boundary, use environment variable flags:

```python
# backend: core/feature_flags.py
import os

FEATURES = {
    "llm_summarisation":   os.getenv("FEATURE_LLM_SUMMARY", "false") == "true",
    "team_workspaces":     os.getenv("FEATURE_TEAMS", "false") == "true",
    "webhook_outbound":    os.getenv("FEATURE_WEBHOOKS", "false") == "true",
    "notion_connector":    os.getenv("FEATURE_NOTION", "false") == "true",
}
```

```typescript
// frontend: lib/features.ts
export const features = {
  llmSummarisation: process.env.NEXT_PUBLIC_FEATURE_LLM_SUMMARY === 'true',
  teamWorkspaces:   process.env.NEXT_PUBLIC_FEATURE_TEAMS === 'true',
};
```

All flags default to `false` in production. New features are built behind flags and only enabled when ready.
