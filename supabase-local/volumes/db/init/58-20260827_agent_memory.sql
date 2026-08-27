BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('semantic', 'episodic', 'reflection')),
  memory_key text NOT NULL CHECK (length(trim(memory_key)) BETWEEN 1 AND 240),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, memory_type, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_user_updated
  ON public.agent_memories(user_id, updated_at DESC);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_memories_owner_access ON public.agent_memories;
CREATE POLICY agent_memories_owner_access ON public.agent_memories
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_memories TO authenticated;
GRANT ALL ON public.agent_memories TO service_role;

COMMIT;
