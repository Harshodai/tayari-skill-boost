-- ==========================================
-- 2026-06-27: AgentSpace Integration Schema
-- Adds support for Digital Employees and Runtime Tool Approvals.
-- ==========================================

-- 1. digital_employees
CREATE TABLE IF NOT EXISTS public.digital_employees (
    employee_id      UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT 'Agent',
    remark_name      TEXT,
    instructions     TEXT,
    traits           JSONB NOT NULL DEFAULT '[]',
    active           BOOLEAN NOT NULL DEFAULT true,
    runtime_id       TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_digital_employees_user ON public.digital_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_employees_active ON public.digital_employees(active);

-- 2. runtime_approvals
CREATE TABLE IF NOT EXISTS public.runtime_approvals (
    approval_id      UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id          UUID REFERENCES public.agent_runs(run_id) ON DELETE CASCADE,
    agent_id         TEXT NOT NULL,
    tool_name        TEXT NOT NULL,
    tool_input       JSONB NOT NULL DEFAULT '{}',
    content_preview  TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_comment TEXT,
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_approvals_user ON public.runtime_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_runtime_approvals_status ON public.runtime_approvals(status);
CREATE INDEX IF NOT EXISTS idx_runtime_approvals_task ON public.runtime_approvals(task_id);
