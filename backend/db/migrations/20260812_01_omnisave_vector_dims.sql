-- WS-07 Omnisave: source_chunks.embedding was declared vector(1536) (OpenAI
-- sizing) but the app embeds with fastembed BAAI/bge-small-en-v1.5 = 384 dims.
-- Any real insert would fail on the dimension mismatch. Re-dimension the column
-- and rebuild the HNSW cosine index to match.

DROP INDEX IF EXISTS idx_source_chunks_embedding_hnsw;

-- Existing rows only ever stored NULL, so nothing is lost.
UPDATE public.source_chunks SET embedding = NULL WHERE embedding IS NOT NULL;

ALTER TABLE public.source_chunks
    ALTER COLUMN embedding TYPE vector(384) USING NULL;

CREATE INDEX idx_source_chunks_embedding_hnsw
    ON public.source_chunks
    USING hnsw (embedding vector_cosine_ops);

-- The unused helper still declares a 1536-dim parameter; drop it so it cannot
-- be called with a mismatched vector. (Retrieval now runs inline in Python.)
DROP FUNCTION IF EXISTS public.match_job_knowledge(TEXT, vector(1536), UUID, TEXT, INT);
