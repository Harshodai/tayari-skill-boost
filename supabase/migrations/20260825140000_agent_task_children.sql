-- Durable bounded-swarm child lifecycle records.
-- Store identifiers, status, timing, and digests only; never specialist output.
CREATE TABLE IF NOT EXISTS public.agent_task_children (
    child_id       UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id        UUID NOT NULL REFERENCES public.agent_tasks(task_id) ON DELETE CASCADE,
    step_id        TEXT NOT NULL,
    role           TEXT NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status         TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'running', 'completed', 'failed', 'timed_out', 'cancelled')),
    input_digest   TEXT NOT NULL,
    output_digest  TEXT,
    error_text     TEXT,
    started_at     TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, step_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_agent_task_children_user ON public.agent_task_children(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_children_task ON public.agent_task_children(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_task_children_status ON public.agent_task_children(status, updated_at);

ALTER TABLE public.agent_task_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_task_children FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_task_children FROM anon, authenticated;
GRANT ALL ON TABLE public.agent_task_children TO service_role;
DROP POLICY IF EXISTS agent_task_children_owner ON public.agent_task_children;
CREATE POLICY agent_task_children_owner ON public.agent_task_children
    FOR ALL TO service_role USING (true) WITH CHECK (true);
