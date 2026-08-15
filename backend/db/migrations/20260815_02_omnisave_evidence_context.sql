-- OmniSaveAI evidence cards and career context graph.
-- Every table is owner-scoped and references saved_sources with cascading cleanup.

CREATE TABLE IF NOT EXISTS public.source_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.saved_sources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    text_excerpt TEXT NOT NULL CHECK (char_length(trim(text_excerpt)) BETWEEN 1 AND 5000),
    start_offset INT CHECK (start_offset IS NULL OR start_offset >= 0),
    end_offset INT CHECK (end_offset IS NULL OR end_offset >= 0),
    note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
    color VARCHAR(24) NOT NULL DEFAULT 'amber',
    action_type VARCHAR(32) NOT NULL DEFAULT 'evidence'
        CHECK (action_type IN ('evidence', 'question', 'flashcard', 'application')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT source_highlights_offsets_valid
        CHECK (start_offset IS NULL OR end_offset IS NULL OR end_offset >= start_offset)
);

CREATE INDEX IF NOT EXISTS idx_source_highlights_owner_source
    ON public.source_highlights (user_id, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_highlights_action
    ON public.source_highlights (user_id, action_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.source_context_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.saved_sources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    context_type VARCHAR(32) NOT NULL
        CHECK (context_type IN ('role', 'company', 'skill', 'application', 'practice', 'interview_stage')),
    context_id VARCHAR(128),
    context_label VARCHAR(240) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_context_links_owner_type
    ON public.source_context_links (user_id, context_type, context_label);
CREATE INDEX IF NOT EXISTS idx_source_context_links_owner_source
    ON public.source_context_links (user_id, source_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_source_context_link
    ON public.source_context_links (
        user_id,
        source_id,
        context_type,
        COALESCE(context_id, ''),
        lower(context_label)
    );

COMMENT ON TABLE public.source_highlights IS 'Candidate-owned excerpts and annotations that can be reused as grounded evidence.';
COMMENT ON TABLE public.source_context_links IS 'Candidate-owned links between saved sources and career preparation contexts.';
