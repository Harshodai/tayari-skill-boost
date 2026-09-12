-- Durable journal for app.services.saga.SagaContext (browser-automation
-- application-flow saga). Previously the saga's step execution and
-- compensation state lived only in an in-memory Python object with
-- un-serializable coroutine closures — a worker crash mid-saga lost all
-- record of it with no trace anywhere. This table gives every saga run a
-- durable, upserted-per-step audit trail, and lets recover_orphaned_sagas()
-- (app/services/saga.py, called from app/tasks/automation.py) detect and
-- mark abandoned runs instead of leaving them stuck "running" forever.
--
-- Service-role-only: this holds internal execution-journal data (step
-- names, error text, best-effort JSON step results), not a user-facing
-- feature table. The Python backend connects as `postgres`, which bypasses
-- RLS entirely (see CLAUDE.md's "RLS scope" note) and is the only real
-- reader/writer; the policy below only matters for the direct
-- PostgREST/anon path, which this table has no reason to ever serve.
CREATE TABLE IF NOT EXISTS saga_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saga_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed', 'orphaned')),
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE (task_id, saga_name)
);

-- The orphan sweep scans for stale running rows across all users in one
-- pass, so it needs an index not scoped to a single user_id.
CREATE INDEX IF NOT EXISTS idx_saga_journal_running_staleness
    ON saga_journal(updated_at) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_saga_journal_user_id ON saga_journal(user_id);

ALTER TABLE saga_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saga_journal_deny_all ON saga_journal;
CREATE POLICY saga_journal_deny_all ON saga_journal
    FOR ALL TO public USING (false) WITH CHECK (false);

GRANT ALL ON saga_journal TO service_role;
