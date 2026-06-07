-- Trailback — Migration 003: Indexes

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
-- Partial index: only index non-NULL keys to keep index small
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
