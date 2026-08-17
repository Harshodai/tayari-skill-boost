-- 2026-08-17: AI provenance and disclosure registry.
-- Technical compliance-readiness schema. Raw prompts, résumé text, secrets, and
-- provider payloads must not be written to provenance metadata by application code.
-- Artifact and disclosure records are owner-scoped; registry metadata is service-role-only.

CREATE TABLE IF NOT EXISTS public.ai_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_key TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    application_type TEXT NOT NULL CHECK (application_type IN (
        'tayari_workflow', 'llm_adapter', 'a2a_peer', 'mcp_server',
        'external_provider', 'system_import', 'unknown'
    )),
    version         TEXT NOT NULL DEFAULT 'unknown',
    approval_state  TEXT NOT NULL DEFAULT 'pending' CHECK (approval_state IN (
        'pending', 'approved', 'blocked', 'retired'
    )),
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_models (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider         TEXT NOT NULL,
    model_identifier TEXT NOT NULL,
    model_version    TEXT NOT NULL DEFAULT 'unknown',
    modality         TEXT NOT NULL DEFAULT 'unknown',
    metadata_status  TEXT NOT NULL DEFAULT 'unknown' CHECK (metadata_status IN (
        'known', 'unknown', 'retired'
    )),
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, model_identifier, model_version)
);

CREATE TABLE IF NOT EXISTS public.artifacts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artifact_type        TEXT NOT NULL,
    current_version_id   UUID,
    origin_classification TEXT NOT NULL DEFAULT 'unknown' CHECK (origin_classification IN (
        'human_only', 'ai_assisted', 'ai_generated', 'ai_transformed',
        'machine_imported', 'unknown', 'disputed'
    )),
    disclosure_status    TEXT NOT NULL DEFAULT 'not_evaluated' CHECK (disclosure_status IN (
        'not_evaluated', 'not_required', 'required_pending', 'disclosed',
        'corrected', 'withdrawn', 'blocked', 'unknown'
    )),
    sensitivity          TEXT NOT NULL DEFAULT 'personal' CHECK (sensitivity IN (
        'public', 'internal', 'personal', 'sensitive_personal', 'secret'
    )),
    retention_class      TEXT NOT NULL DEFAULT 'operational' CHECK (retention_class IN (
        'short_lived', 'operational', 'audit', 'legal_hold',
        'delete_on_request', 'unknown'
    )),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.artifact_versions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id       UUID NOT NULL,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_version_id UUID,
    content_hash      VARCHAR(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    mime_type         TEXT NOT NULL DEFAULT 'application/json',
    storage_ref       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    superseded_at     TIMESTAMPTZ,
    UNIQUE (id, user_id),
    UNIQUE (artifact_id, user_id, content_hash),
    FOREIGN KEY (artifact_id, user_id)
        REFERENCES public.artifacts(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_version_id, user_id)
        REFERENCES public.artifact_versions(id, user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.artifact_origin_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artifact_id       UUID NOT NULL,
    artifact_version_id UUID NOT NULL,
    idempotency_key   TEXT NOT NULL,
    event_type        TEXT NOT NULL CHECK (event_type IN (
        'human_created', 'human_edited', 'ai_invoked', 'ai_generated',
        'ai_transformed', 'machine_imported', 'a2a_received', 'mcp_received',
        'provider_retrieved', 'human_reviewed', 'approved', 'rejected',
        'disclosure_computed', 'disclosure_presented', 'exported',
        'corrected', 'disputed', 'failed', 'deleted_or_redacted'
    )),
    origin_actor      TEXT NOT NULL CHECK (origin_actor IN (
        'human', 'ai_system', 'external_provider', 'system_import', 'unknown'
    )),
    producer_type     TEXT NOT NULL CHECK (producer_type IN (
        'human_user', 'tayari_workflow', 'llm_provider', 'a2a_peer',
        'mcp_server', 'firecrawl', 'apify', 'browser_capture',
        'file_import', 'unknown'
    )),
    application_id    UUID REFERENCES public.ai_applications(id) ON DELETE RESTRICT,
    model_id          UUID REFERENCES public.ai_models(id) ON DELETE RESTRICT,
    parent_content_hash VARCHAR(64) CHECK (parent_content_hash IS NULL OR parent_content_hash ~ '^[0-9a-f]{64}$'),
    input_hashes      JSONB NOT NULL DEFAULT '[]'::jsonb,
    output_hash       VARCHAR(64) CHECK (output_hash IS NULL OR output_hash ~ '^[0-9a-f]{64}$'),
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    trace_id          TEXT,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    policy_version    TEXT,
    evidence_refs     JSONB NOT NULL DEFAULT '[]'::jsonb,
    failure_code      TEXT,
    payload_hash      VARCHAR(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
    UNIQUE (user_id, idempotency_key),
    FOREIGN KEY (artifact_id, user_id)
        REFERENCES public.artifacts(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (artifact_version_id, user_id)
        REFERENCES public.artifact_versions(id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.artifact_disclosures (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artifact_id           UUID NOT NULL,
    artifact_version_id   UUID NOT NULL,
    classification        TEXT NOT NULL CHECK (classification IN (
        'human_only', 'ai_assisted', 'ai_generated', 'ai_transformed',
        'machine_imported', 'unknown', 'disputed'
    )),
    user_label            TEXT NOT NULL,
    reason_codes          JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence            TEXT NOT NULL DEFAULT 'unknown' CHECK (confidence IN (
        'high', 'medium', 'low', 'unknown'
    )),
    human_review_status   TEXT NOT NULL DEFAULT 'unknown' CHECK (human_review_status IN (
        'not_required', 'pending', 'reviewed', 'approved', 'rejected',
        'disputed', 'unknown'
    )),
    disclosure_status     TEXT NOT NULL DEFAULT 'required_pending' CHECK (disclosure_status IN (
        'not_evaluated', 'not_required', 'required_pending', 'disclosed',
        'corrected', 'withdrawn', 'blocked', 'unknown'
    )),
    audience              TEXT NOT NULL DEFAULT 'owner',
    channel               TEXT NOT NULL DEFAULT 'internal',
    policy_version        TEXT NOT NULL DEFAULT 'ai-provenance-v1',
    evaluator_version     TEXT NOT NULL DEFAULT 'disclosure-evaluator-v1',
    supporting_event_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
    redacted_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (artifact_version_id, user_id, policy_version, evaluator_version, channel),
    FOREIGN KEY (artifact_id, user_id)
        REFERENCES public.artifacts(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (artifact_version_id, user_id)
        REFERENCES public.artifact_versions(id, user_id) ON DELETE CASCADE
);

ALTER TABLE public.artifacts
    DROP CONSTRAINT IF EXISTS artifacts_current_version_owner_fk;
ALTER TABLE public.artifacts
    ADD CONSTRAINT artifacts_current_version_owner_fk
    FOREIGN KEY (current_version_id, user_id)
    REFERENCES public.artifact_versions(id, user_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ai_applications_type_state
    ON public.ai_applications(application_type, approval_state);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider_identifier
    ON public.ai_models(provider, model_identifier);
CREATE INDEX IF NOT EXISTS idx_artifacts_user_origin_created
    ON public.artifacts(user_id, origin_classification, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_user_disclosure
    ON public.artifacts(user_id, disclosure_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_user_created
    ON public.artifact_versions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_origin_events_user_type_time
    ON public.artifact_origin_events(user_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_origin_events_artifact_time
    ON public.artifact_origin_events(user_id, artifact_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_disclosures_user_classification
    ON public.artifact_disclosures(user_id, classification, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosures_user_status
    ON public.artifact_disclosures(user_id, disclosure_status, updated_at DESC);

-- Registry metadata is not directly writable by end users.
REVOKE ALL ON TABLE public.ai_applications FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_models FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_applications TO service_role;
GRANT ALL ON TABLE public.ai_models TO service_role;

-- Owner-facing artifacts and disclosure records are read-only to authenticated users;
-- server-side provenance services write through service_role after verified identity checks.
REVOKE ALL ON TABLE public.artifacts FROM anon;
REVOKE ALL ON TABLE public.artifact_versions FROM anon;
REVOKE ALL ON TABLE public.artifact_origin_events FROM anon;
REVOKE ALL ON TABLE public.artifact_disclosures FROM anon;
GRANT SELECT ON TABLE public.artifacts TO authenticated;
GRANT SELECT ON TABLE public.artifact_versions TO authenticated;
GRANT SELECT ON TABLE public.artifact_origin_events TO authenticated;
GRANT SELECT ON TABLE public.artifact_disclosures TO authenticated;
GRANT ALL ON TABLE public.artifacts TO service_role;
GRANT ALL ON TABLE public.artifact_versions TO service_role;
GRANT ALL ON TABLE public.artifact_origin_events TO service_role;
GRANT ALL ON TABLE public.artifact_disclosures TO service_role;

ALTER TABLE public.ai_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_origin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_disclosures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_applications_service_all ON public.ai_applications;
CREATE POLICY ai_applications_service_all ON public.ai_applications
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS ai_models_service_all ON public.ai_models;
CREATE POLICY ai_models_service_all ON public.ai_models
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS artifacts_owner_select ON public.artifacts;
CREATE POLICY artifacts_owner_select ON public.artifacts
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS artifacts_service_all ON public.artifacts;
CREATE POLICY artifacts_service_all ON public.artifacts
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS artifact_versions_owner_select ON public.artifact_versions;
CREATE POLICY artifact_versions_owner_select ON public.artifact_versions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS artifact_versions_service_all ON public.artifact_versions;
CREATE POLICY artifact_versions_service_all ON public.artifact_versions
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS artifact_origin_events_owner_select ON public.artifact_origin_events;
CREATE POLICY artifact_origin_events_owner_select ON public.artifact_origin_events
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS artifact_origin_events_service_all ON public.artifact_origin_events;
CREATE POLICY artifact_origin_events_service_all ON public.artifact_origin_events
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS artifact_disclosures_owner_select ON public.artifact_disclosures;
CREATE POLICY artifact_disclosures_owner_select ON public.artifact_disclosures
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS artifact_disclosures_service_all ON public.artifact_disclosures;
CREATE POLICY artifact_disclosures_service_all ON public.artifact_disclosures
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
