-- Trailback — Migration 005: Realtime
-- Enable Supabase Realtime for live dashboard updates

ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rollbacks;
