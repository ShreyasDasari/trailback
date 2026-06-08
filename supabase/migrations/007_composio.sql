-- Trailback — Migration 007: Composio integration
-- Adds composio_account_id to connectors table so the rollback worker
-- can call Composio execute() with the correct connected account reference.

ALTER TABLE public.connectors
    ADD COLUMN IF NOT EXISTS composio_account_id TEXT;

COMMENT ON COLUMN public.connectors.composio_account_id IS
    'Composio connected account ID (ca_...). Set by /connectors/confirm after OAuth.';
