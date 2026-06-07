-- Trailback — Migration 004: Row Level Security

-- ── Enable RLS on all tables ──────────────────────────────────
ALTER TABLE public.events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollbacks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents     ENABLE ROW LEVEL SECURITY;

-- ── Events: full access to own rows only ──────────────────────
CREATE POLICY "events_user_isolation" ON public.events
    FOR ALL USING (auth.uid() = user_id);

-- ── Snapshots: accessible only via owned events ───────────────
CREATE POLICY "snapshots_via_owned_events" ON public.snapshots
    FOR ALL USING (
        event_id IN (
            SELECT id FROM public.events WHERE user_id = auth.uid()
        )
    );

-- ── Rollbacks: own rows only ──────────────────────────────────
CREATE POLICY "rollbacks_user_isolation" ON public.rollbacks
    FOR ALL USING (user_id = auth.uid());

-- ── Connectors: own rows only ─────────────────────────────────
CREATE POLICY "connectors_user_isolation" ON public.connectors
    FOR ALL USING (user_id = auth.uid());

-- ── Agents: own rows only ─────────────────────────────────────
CREATE POLICY "agents_user_isolation" ON public.agents
    FOR ALL USING (user_id = auth.uid());

-- ── Service role bypass (backend only) ───────────────────────
-- The FastAPI backend uses SUPABASE_SERVICE_KEY which
-- bypasses RLS. Never expose this key to the frontend.
