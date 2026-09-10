-- Keep the saved_sources platform constraint aligned with OmniSaveAI URL classification.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.saved_sources'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%source_platform%'
    LOOP
        EXECUTE format('ALTER TABLE public.saved_sources DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END;
$$;

ALTER TABLE public.saved_sources
    ADD CONSTRAINT saved_sources_source_platform_check
    CHECK (source_platform IN ('substack', 'medium', 'linkedin', 'instagram', 'custom_url'));
