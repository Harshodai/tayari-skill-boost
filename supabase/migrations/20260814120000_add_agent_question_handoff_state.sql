-- Durable HITL state for self-hosted and Supabase question queues.
ALTER TABLE public.agent_questions
  ADD COLUMN IF NOT EXISTS handoff_state TEXT NOT NULL DEFAULT 'needs_human';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_questions_handoff_state_check'
  ) THEN
    ALTER TABLE public.agent_questions
      ADD CONSTRAINT agent_questions_handoff_state_check
      CHECK (handoff_state IN ('needs_human', 'resolved', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_questions_handoff_idx
  ON public.agent_questions (user_id, handoff_state, created_at DESC);
