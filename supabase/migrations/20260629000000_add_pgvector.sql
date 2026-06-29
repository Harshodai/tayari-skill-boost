-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document embeddings table for semantic search
CREATE TABLE public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('resume', 'job', 'conversation', 'skill')),
  content_id TEXT NOT NULL,
  content_hash TEXT NOT NULL, -- For cache invalidation
  embedding vector(384) NOT NULL, -- BAAI/bge-small-en-v1.5 dimensions
  text_preview TEXT, -- First 200 chars for display
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);

-- Indexes for fast similarity search
CREATE INDEX idx_doc_embeddings_user_type ON public.document_embeddings(user_id, content_type);
CREATE INDEX idx_doc_embeddings_vector ON public.document_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS policies
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own embeddings"
ON public.document_embeddings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embeddings"
ON public.document_embeddings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own embeddings"
ON public.document_embeddings FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_doc_embeddings_updated_at
BEFORE UPDATE ON public.document_embeddings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
