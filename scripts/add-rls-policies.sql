-- Enable RLS on events table if not already enabled
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for events table
CREATE POLICY events_select_policy ON public.events FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY events_insert_policy ON public.events FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY events_update_policy ON public.events FOR UPDATE 
USING (auth.uid() = user_id);

-- Enable RLS on rollbacks table
ALTER TABLE public.rollbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY rollbacks_select_policy ON public.rollbacks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY rollbacks_insert_policy ON public.rollbacks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Enable RLS on snapshots table
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY snapshots_select_policy ON public.snapshots FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = snapshots.event_id AND events.user_id = auth.uid()));

-- Enable RLS on connectors table
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY connectors_select_policy ON public.connectors FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY connectors_insert_policy ON public.connectors FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY connectors_update_policy ON public.connectors FOR UPDATE 
USING (auth.uid() = user_id);
