-- Trailback — Migration 002: Core Tables
-- Creates events, snapshots, rollbacks, connectors, agents

-- ──────────────────────────────────────────────────────────────
-- TABLE: events
-- Every agent action. One row per atomic operation.
-- Append-only: no UPDATE or DELETE by application user.
-- ──────────────────────────────────────────────────────────────
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
    risk_reasons      TEXT[]      NOT NULL DEFAULT '{}',
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

-- ──────────────────────────────────────────────────────────────
-- TABLE: snapshots
-- Before/after state for each event.
-- ──────────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────────
-- TABLE: rollbacks
-- Full history of every rollback operation attempt.
-- ──────────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────────
-- TABLE: connectors
-- OAuth connection state per user per app.
-- ──────────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────────
-- TABLE: agents
-- Registered AI agents and their trust profile.
-- ──────────────────────────────────────────────────────────────
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
