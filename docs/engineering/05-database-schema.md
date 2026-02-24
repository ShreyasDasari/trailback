# 05 — Database Schema
**Project:** Trailback
**Version:** 1.0
**Database:** Supabase (PostgreSQL 15)
**Last Updated:** February 2026

---

## 1. Schema Overview

```
auth.users (Supabase managed)
    │
    ├── 1:N ──▶ events
    │               │
    │               ├── 1:N ──▶ snapshots
    │               └── 1:N ──▶ rollbacks
    │
    ├── 1:N ──▶ connectors  (1 per app per user)
    └── 1:N ──▶ agents
```

---

## 2. Migration 001 — Extensions

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## 3. Migration 002 — Core Tables

```sql
-- ──────────────────────────────────────────────────────────
-- TABLE: events
-- Every agent action. One row per atomic operation.
-- Append-only: no UPDATE or DELETE by application user.
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.events (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id          TEXT        NOT NULL DEFAULT 'unknown',
    app               TEXT        NOT NULL,
    action_type       TEXT        NOT NULL,
    intent            TEXT,
    status            TEXT        NOT NULL DEFAULT 'completed',
    risk_level        TEXT        NOT NULL DEFAULT 'low',
    risk_score        INTEGER     NOT NULL DEFAULT 0,
    risk_reasons      TEXT[],
    rollback_status   TEXT        NOT NULL DEFAULT 'available',
    idempotency_key   TEXT        UNIQUE,
    metadata          JSONB       NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT events_app_check
        CHECK (app IN ('gmail', 'gdocs', 'slack')),
    CONSTRAINT events_status_check
        CHECK (status IN ('completed', 'rolled_back', 'partial', 'failed')),
    CONSTRAINT events_risk_check
        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT events_rollback_check
        CHECK (rollback_status IN ('available', 'executed', 'unavailable', 'failed'))
);

COMMENT ON TABLE public.events IS
  'Append-only log of every AI agent action. Never update or delete rows.';

-- ──────────────────────────────────────────────────────────
-- TABLE: snapshots
-- Before/after state for each event.
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.snapshots (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    snapshot_type   TEXT        NOT NULL,
    content         JSONB       NOT NULL,
    content_hash    TEXT        NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT snapshots_type_check
        CHECK (snapshot_type IN ('before', 'after'))
);

COMMENT ON TABLE public.snapshots IS
  'Before and after state snapshots for every event. content_hash enables integrity verification.';

-- ──────────────────────────────────────────────────────────
-- TABLE: rollbacks
-- Full history of every rollback operation attempt.
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.rollbacks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID        NOT NULL REFERENCES public.events(id),
    user_id         UUID        NOT NULL REFERENCES auth.users(id),
    initiated_by    TEXT        NOT NULL DEFAULT 'user',
    result          TEXT,
    failure_reason  TEXT,
    api_response    JSONB,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rollbacks_result_check
        CHECK (result IN ('success', 'failed', 'partial', 'pending') OR result IS NULL)
);

-- ──────────────────────────────────────────────────────────
-- TABLE: connectors
-- OAuth connection state per user per app.
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.connectors (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    app             TEXT        NOT NULL,
    oauth_token     TEXT,
    refresh_token   TEXT,
    scopes          TEXT[],
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,

    CONSTRAINT connectors_app_check
        CHECK (app IN ('gmail', 'gdocs', 'slack')),
    CONSTRAINT connectors_unique_user_app
        UNIQUE (user_id, app)
);

COMMENT ON TABLE public.connectors IS
  'OAuth tokens stored encrypted. Never return raw tokens to the frontend.';

-- ──────────────────────────────────────────────────────────
-- TABLE: agents
-- Registered AI agents and their trust profile.
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.agents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    agent_key       TEXT        UNIQUE NOT NULL
                                DEFAULT encode(gen_random_bytes(24), 'base64'),
    total_actions   INTEGER     NOT NULL DEFAULT 0,
    rolled_back     INTEGER     NOT NULL DEFAULT 0,
    trust_score     FLOAT       NOT NULL DEFAULT 1.0
                                CHECK (trust_score >= 0.0 AND trust_score <= 1.0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agents IS
  'Trust score = 1 - (rolled_back / total_actions). Recomputed on every rollback.';
```

---

## 4. Migration 003 — Indexes

```sql
-- Timeline feed: most common query pattern
CREATE INDEX idx_events_user_created
    ON public.events(user_id, created_at DESC);

-- App filter
CREATE INDEX idx_events_app
    ON public.events(app);

-- Risk level filter
CREATE INDEX idx_events_risk_level
    ON public.events(risk_level);

-- Rollback status filter
CREATE INDEX idx_events_rollback_status
    ON public.events(rollback_status);

-- Idempotency key lookup (deduplication)
CREATE UNIQUE INDEX idx_events_idempotency
    ON public.events(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Snapshot lookups by event
CREATE INDEX idx_snapshots_event_id
    ON public.snapshots(event_id);

-- Connector lookup by user
CREATE INDEX idx_connectors_user_id
    ON public.connectors(user_id);

-- Agent lookup by user
CREATE INDEX idx_agents_user_id
    ON public.agents(user_id);
```

---

## 5. Migration 004 — Row Level Security

```sql
-- ── Enable RLS on all tables ──────────────────────────────
ALTER TABLE public.events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollbacks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents     ENABLE ROW LEVEL SECURITY;

-- ── Events: full access to own rows only ─────────────────
CREATE POLICY "events_user_isolation" ON public.events
    FOR ALL USING (auth.uid() = user_id);

-- ── Snapshots: accessible only via owned events ──────────
CREATE POLICY "snapshots_via_owned_events" ON public.snapshots
    FOR ALL USING (
        event_id IN (
            SELECT id FROM public.events WHERE user_id = auth.uid()
        )
    );

-- ── Rollbacks: own rows only ─────────────────────────────
CREATE POLICY "rollbacks_user_isolation" ON public.rollbacks
    FOR ALL USING (user_id = auth.uid());

-- ── Connectors: own rows only ────────────────────────────
CREATE POLICY "connectors_user_isolation" ON public.connectors
    FOR ALL USING (user_id = auth.uid());

-- ── Agents: own rows only ────────────────────────────────
CREATE POLICY "agents_user_isolation" ON public.agents
    FOR ALL USING (user_id = auth.uid());

-- ── Service role bypass (backend only) ───────────────────
-- The FastAPI backend uses SUPABASE_SERVICE_KEY which
-- bypasses RLS. Never expose this key to the frontend.
```

---

## 6. Migration 005 — Realtime

```sql
-- Enable Realtime publication for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rollbacks;
```

---

## 7. Migration 006 — Updated At Trigger

```sql
-- Auto-update updated_at on events table
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

## 8. Key Query Patterns

### Timeline feed (most frequent)
```sql
SELECT e.*, 
       s_before.content AS before_content,
       s_after.content  AS after_content
FROM public.events e
LEFT JOIN public.snapshots s_before
    ON s_before.event_id = e.id AND s_before.snapshot_type = 'before'
LEFT JOIN public.snapshots s_after
    ON s_after.event_id  = e.id AND s_after.snapshot_type  = 'after'
WHERE e.user_id = $1
ORDER BY e.created_at DESC
LIMIT 20 OFFSET $2;
```

### Risk-filtered feed
```sql
SELECT * FROM public.events
WHERE user_id = $1
  AND risk_level = ANY($2::text[])
  AND app = ANY($3::text[])
ORDER BY created_at DESC
LIMIT 20 OFFSET $4;
```

### Rollback eligibility check
```sql
SELECT e.id, e.rollback_status, e.app, e.metadata,
       c.oauth_token, c.is_active
FROM public.events e
JOIN public.connectors c ON c.user_id = e.user_id AND c.app = e.app
WHERE e.id = $1 AND e.user_id = $2;
```

---

## 9. Data Retention Policy

| Plan | Retention | Implementation |
|------|-----------|---------------|
| Free | 7 days | Nightly cron: `DELETE FROM events WHERE created_at < NOW() - INTERVAL '7 days'` |
| Pro | 90 days | Same cron with 90-day interval |
| Team | 1 year | Same cron with 1-year interval |
| Compliance | Unlimited | No deletion cron |

The cron job is implemented as a Supabase Edge Function scheduled via Supabase's cron feature (free tier).

---

## 10. Storage Estimates

```
Per event row:        ~1 KB  (metadata JSONB)
Per snapshot pair:   ~10 KB  (before + after content)
Full event total:    ~11 KB

At MVP scale (500 MAU, 50 events/user/day):
  Events per day:     25,000
  Storage per day:   ~275 MB
  With 7-day free retention: ~1.9 GB rolling
  → Requires Pro or aggressive cleanup on free tier

Realistic MVP (100 DAU, 10 active events/day):
  Events per day:     1,000
  Storage per day:   ~11 MB
  7-day window:      ~77 MB ← well within 500MB free tier
```
