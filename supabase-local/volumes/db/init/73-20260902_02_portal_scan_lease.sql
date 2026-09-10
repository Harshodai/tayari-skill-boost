-- Add last_scanned_at column and index to user_portals for distributed lease
ALTER TABLE IF EXISTS public.user_portals
    ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_portals_scan
    ON public.user_portals (last_scanned_at)
    WHERE enabled = true;
