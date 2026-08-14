-- OmniSaveAI NLP metadata: validated, user-visible enrichment provenance.
ALTER TABLE public.saved_sources
  ADD COLUMN IF NOT EXISTS nlp_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_saved_sources_nlp_metadata
  ON public.saved_sources USING GIN (nlp_metadata);
