-- Add RLS policies for events table
-- Users can view their own events
CREATE POLICY IF NOT EXISTS "Users can view own events" 
ON public.events 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own events
CREATE POLICY IF NOT EXISTS "Users can insert own events" 
ON public.events 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own events
CREATE POLICY IF NOT EXISTS "Users can update own events" 
ON public.events 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add RLS policies for rollbacks table
CREATE POLICY IF NOT EXISTS "Users can view own rollbacks" 
ON public.rollbacks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own rollbacks" 
ON public.rollbacks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add RLS policies for snapshots table
-- Snapshots are linked to events, so we need to join
CREATE POLICY IF NOT EXISTS "Users can view own snapshots" 
ON public.snapshots 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = snapshots.event_id 
    AND events.user_id = auth.uid()
  )
);
