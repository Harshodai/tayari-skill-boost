-- M9-01: durable candidate-controlled workflow stage envelope.
-- This migration is additive and repeatable. It deliberately stores hashes and
-- bounded provenance metadata, not resume/job contents or provider payloads.
CREATE TABLE IF NOT EXISTS public.application_stage_envelopes (
    envelope_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    run_id UUID REFERENCES public.agent_runs(run_id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID,
    stage_key TEXT NOT NULL CHECK (stage_key IN (
        'resume_ingested', 'job_discovered', 'fit_analyzed', 'resume_tailored',
        'cover_letter_created', 'review_package_created', 'tracking_recorded'
    )),
    stage_version INTEGER NOT NULL DEFAULT 1 CHECK (stage_version > 0),
    profile_snapshot_hash TEXT,
    job_identity_key TEXT,
    job_source_url TEXT,
    job_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    artifact_hash TEXT,
    artifact_version TEXT,
    artifact_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    approval_state TEXT NOT NULL DEFAULT 'not_required' CHECK (approval_state IN (
        'not_required', 'pending_review', 'candidate_confirmed', 'approved',
        'expired', 'rejected', 'consumed'
    )),
    failure_state JSONB,
    input_hash TEXT,
    output_hash TEXT,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (application_id, stage_key, stage_version)
);

CREATE INDEX IF NOT EXISTS application_stage_envelopes_owner_idx
    ON public.application_stage_envelopes(user_id, application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS application_stage_envelopes_job_idx
    ON public.application_stage_envelopes(user_id, job_identity_key)
    WHERE job_identity_key IS NOT NULL;

ALTER TABLE public.application_stage_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_stage_envelopes FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_stage_envelopes'
      AND policyname = 'application_stage_envelopes_owner'
  ) THEN
    CREATE POLICY application_stage_envelopes_owner
      ON public.application_stage_envelopes
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_application_stage_envelopes_updated'
      AND tgrelid = 'public.application_stage_envelopes'::regclass
  ) THEN
    CREATE TRIGGER trg_application_stage_envelopes_updated
      BEFORE UPDATE ON public.application_stage_envelopes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_stage_envelopes TO authenticated;
GRANT ALL ON public.application_stage_envelopes TO service_role;
