-- ==========================================
-- 2026-06-28: AgentSpace Events and Tasks Schema
-- Adds support for enqueuable Agent Tasks, Attempts, and Execution Step Events.
-- ==========================================

-- 1. agent_tasks
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    task_id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id         TEXT NOT NULL,
    title            TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'failed')),
    input_json       JSONB NOT NULL DEFAULT '{}',
    result_json      JSONB NOT NULL DEFAULT '{}',
    error_text       TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON public.agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON public.agent_tasks(agent_id);

-- 2. agent_task_attempts
CREATE TABLE IF NOT EXISTS public.agent_task_attempts (
    attempt_id       UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id          UUID NOT NULL REFERENCES public.agent_tasks(task_id) ON DELETE CASCADE,
    attempt_number   INTEGER NOT NULL DEFAULT 1,
    status           TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    started_at       TIMESTAMPTZ DEFAULT NOW(),
    finished_at      TIMESTAMPTZ,
    error_text       TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_task_attempts_user ON public.agent_task_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_attempts_task ON public.agent_task_attempts(task_id);

-- 3. agent_router_events
CREATE TABLE IF NOT EXISTS public.agent_router_events (
    event_id         UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id          UUID NOT NULL REFERENCES public.agent_tasks(task_id) ON DELETE CASCADE,
    type             TEXT NOT NULL,
    summary          TEXT NOT NULL,
    payload_json     JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_router_events_user ON public.agent_router_events(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_router_events_task ON public.agent_router_events(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_router_events_created ON public.agent_router_events(created_at);
