-- Conversations table for persistent chat memory
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  -- Message format: [{"role": "user|assistant", "content": "...", "timestamp": "..."}]
  summary TEXT, -- Auto-generated summary for long conversations
  context_type TEXT DEFAULT 'general', -- 'job_search', 'resume_opt', 'interview_prep', 'general'
  related_job_id UUID, -- Link to a specific job if applicable
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);
CREATE INDEX idx_conversations_context ON public.conversations(user_id, context_type);

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own conversations"
ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-summarize long conversations
CREATE OR REPLACE FUNCTION public.maybe_summarize_conversation()
RETURNS TRIGGER AS $$
BEGIN
  IF jsonb_array_length(NEW.messages) > 20 AND NEW.summary IS NULL THEN
    -- Mark for summarization (actual summarization done by backend)
    NEW.summary = '[PENDING_SUMMARIZATION]';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_maybe_summarize
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.maybe_summarize_conversation();
