BEGIN;

ALTER TABLE public.automation_runs
    ADD COLUMN IF NOT EXISTS lease_owner UUID,
    ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reclaim_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'automation_runs_reclaim_count_nonnegative'
          AND conrelid = 'public.automation_runs'::regclass
    ) THEN
        ALTER TABLE public.automation_runs
            ADD CONSTRAINT automation_runs_reclaim_count_nonnegative
            CHECK (reclaim_count >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_runs_expired_leases
    ON public.automation_runs (lease_expires_at, updated_at)
    WHERE status = 'running' AND lease_expires_at IS NOT NULL;

COMMENT ON COLUMN public.automation_runs.lease_owner IS
    'Ephemeral worker instance UUID holding the execution lease; not an end-user identity.';
COMMENT ON COLUMN public.automation_runs.lease_expires_at IS
    'Heartbeat deadline. A running row may be reclaimed after this time.';
COMMENT ON COLUMN public.automation_runs.reclaim_count IS
    'Number of times a stale worker lease was reclaimed.';
COMMENT ON COLUMN public.automation_runs.last_heartbeat_at IS
    'Most recent durable heartbeat from the lease owner.';

COMMIT;
