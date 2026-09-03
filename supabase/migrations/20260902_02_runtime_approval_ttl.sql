-- Add expiry to runtime_approvals so stale approvals cannot be executed indefinitely
ALTER TABLE IF EXISTS public.runtime_approvals
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill existing rows from their own created_at rather than the migration run time
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'runtime_approvals'
          AND column_name = 'created_at'
    ) THEN
        UPDATE public.runtime_approvals
            SET expires_at = created_at + INTERVAL '15 minutes'
            WHERE expires_at IS NULL;

        ALTER TABLE public.runtime_approvals
            ALTER COLUMN expires_at SET NOT NULL,
            ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '15 minutes');

        CREATE INDEX IF NOT EXISTS idx_runtime_approvals_expires
            ON public.runtime_approvals (expires_at)
            WHERE status = 'pending';
    END IF;
END $$;
