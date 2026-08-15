-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Autopilot Checkpointing
DO $$ BEGIN
    CREATE TYPE autopilot_stage AS ENUM (
        'INITIATED', 'RESUME_TAILORED', 'COVER_LETTER_GENERATED', 
        'AUTO_APPLY_PAYLOAD_READY', 'RECRUITER_INTEL_GATHERED', 
        'INTERVIEW_KIT_COMPILED', 'COMPLETED', 'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.autopilot_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL,
    job_id UUID NOT NULL,
    current_stage autopilot_stage NOT NULL DEFAULT 'INITIATED',
    state_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_log JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Human-In-The-Loop Approval Queue
DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.agent_action_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL,
    run_id BIGINT REFERENCES public.autopilot_runs(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL, -- 'SUBMIT_ATS_APPLICATION', 'SEND_RECRUITER_EMAIL'
    action_payload JSONB NOT NULL,
    status approval_status NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Omnisave AI Knowledge Vector Storage
CREATE TABLE IF NOT EXISTS public.saved_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    idempotency_hash VARCHAR(64) NOT NULL,
    source_platform VARCHAR(32) NOT NULL CHECK (source_platform IN ('substack', 'medium', 'linkedin', 'custom_url')),
    canonical_url TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    publication_name TEXT,
    raw_content TEXT NOT NULL,
    clean_markdown TEXT NOT NULL,
    primary_category VARCHAR(64),
    secondary_tags TEXT[],
    summary_bullets TEXT[],
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ponytail: remove prior single-column unique artifacts (name may differ across
-- legacy installs) so the composite (user_id, idempotency_hash) index can own
-- uniqueness. This preserves compatibility with omnisave_service._persist_source_db's
-- ON CONFLICT (user_id, idempotency_hash) target.
-- Indexes are inspected by their key columns (user_id, idempotency_hash), not
-- by index/constraint name, so a standalone or differently named legacy unique
-- index on idempotency_hash is removed too; only the composite stays.
DO $$
DECLARE
    idx_name TEXT;
    con_name TEXT;
    col_count INT;
    has_hash_col BOOLEAN;
BEGIN
    FOR idx_name IN
        SELECT i.relname
        FROM pg_catalog.pg_index ix
        JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
        JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'saved_sources'
          AND ix.indisunique
    LOOP
        SELECT count(*)
          INTO col_count
          FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_class i2 ON i2.oid = a.attrelid
          WHERE i2.relname = idx_name;

        SELECT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class i3 ON i3.oid = a.attrelid
            WHERE i3.relname = idx_name AND a.attname = 'idempotency_hash'
        ) INTO has_hash_col;

        -- Drop only unique single-column indexes on idempotency_hash (the
        -- legacy artifacts). The composite (user_id, idempotency_hash) index is
        -- two columns, so it is never matched here.
        IF col_count = 1 AND has_hash_col THEN
            -- A constraint-backed index cannot be dropped directly; drop the
            -- owning constraint, which removes its index. Standalone indexes
            -- are dropped by name.
            SELECT c.conname
              INTO con_name
              FROM pg_catalog.pg_constraint c
             WHERE c.conindid = (SELECT ix4.indexrelid
                                   FROM pg_catalog.pg_index ix4
                                   JOIN pg_catalog.pg_class i4 ON i4.oid = ix4.indexrelid
                                  WHERE i4.relname = idx_name
                                  LIMIT 1);
            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE public.saved_sources DROP CONSTRAINT %I', con_name);
            ELSE
                EXECUTE format('DROP INDEX %I.%I', 'public', idx_name);
            END IF;
        END IF;
    END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_sources_user_hash ON public.saved_sources (user_id, idempotency_hash);

CREATE TABLE IF NOT EXISTS public.source_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.saved_sources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    chunk_index INT NOT NULL,
    chunk_content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small
    fts_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_content)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_chunks_embedding_hnsw 
ON public.source_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_source_chunks_fts ON public.source_chunks USING gin (fts_vector);

-- 4. Audit Log
CREATE TABLE IF NOT EXISTS public.candidate_agent_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    candidate_id UUID NOT NULL,
    run_id BIGINT REFERENCES public.autopilot_runs(id) ON DELETE SET NULL,
    actor_type VARCHAR(50) NOT NULL, -- 'AGENT', 'USER', 'SYSTEM'
    action_name VARCHAR(150) NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Hybrid Search Procedure (Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION public.match_job_knowledge(
    query_text TEXT,
    query_embedding vector(1536),
    match_user_id UUID,
    filter_category TEXT DEFAULT NULL,
    match_count INT DEFAULT 8
)
RETURNS TABLE (
    chunk_id UUID,
    source_id UUID,
    title TEXT,
    author TEXT,
    canonical_url TEXT,
    source_platform VARCHAR(32),
    chunk_content TEXT,
    score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_matches AS (
        SELECT c.id AS chunk_id, ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank_vec
        FROM public.source_chunks c
        JOIN public.saved_sources s ON c.source_id = s.id
        WHERE c.user_id = match_user_id AND (filter_category IS NULL OR s.primary_category = filter_category)
        ORDER BY c.embedding <=> query_embedding LIMIT 30
    ),
    fts_matches AS (
        SELECT c.id AS chunk_id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.fts_vector, websearch_to_tsquery('english', query_text)) DESC) AS rank_fts
        FROM public.source_chunks c
        JOIN public.saved_sources s ON c.source_id = s.id
        WHERE c.user_id = match_user_id AND (filter_category IS NULL OR s.primary_category = filter_category)
          AND c.fts_vector @@ websearch_to_tsquery('english', query_text)
        ORDER BY ts_rank_cd(c.fts_vector, websearch_to_tsquery('english', query_text)) DESC LIMIT 30
    )
    SELECT c.id AS chunk_id, s.id AS source_id, s.title, s.author, s.canonical_url, s.source_platform, c.chunk_content,
        COALESCE(1.0 / (60 + vm.rank_vec), 0.0) + COALESCE(1.0 / (60 + fm.rank_fts), 0.0) AS score
    FROM vector_matches vm
    FULL OUTER JOIN fts_matches fm ON vm.chunk_id = fm.chunk_id
    JOIN public.source_chunks c ON COALESCE(vm.chunk_id, fm.chunk_id) = c.id
    JOIN public.saved_sources s ON c.source_id = s.id
    ORDER BY score DESC LIMIT match_count;
END;
$$;
