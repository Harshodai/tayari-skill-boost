-- 20260630_communications_response_tracking.sql
-- Audit action #6: track per-touchpoint response rate across the post-apply
-- communication arc (follow-up / thank-you / negotiation / status-check).
--
-- Until now generated messages were returned to the UI and never persisted, so
-- there was no way to measure which touchpoints actually get replies — the
-- single most underserved part of job search per tayari_insights #3.
--
-- This table is the write path: every generated message is stored on creation
-- (response_status='sent'); the user marks it responded (or no-response) once
-- they hear back. The per-type aggregate drives the CommunicationHub response-
-- rate card.
--
-- Conventions mirror 20260620_hermes_agents.sql: auth.users FK with CASCADE,
-- IF NOT EXISTS, idempotent indexes.

CREATE TABLE IF NOT EXISTS public.communications (
    id              bigserial PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id  text,
    comm_type       text NOT NULL,   -- follow-up | thank-you | negotiation | status-check
    job_title       text,
    company_name    text,
    subject         text,
    body            text NOT NULL,
    response_status text NOT NULL DEFAULT 'sent',  -- sent | responded | no_response
    created_at      timestamptz NOT NULL DEFAULT now(),
    responded_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_communications_user_id
    ON public.communications(user_id);
CREATE INDEX IF NOT EXISTS idx_communications_user_type
    ON public.communications(user_id, comm_type);
CREATE INDEX IF NOT EXISTS idx_communications_status
    ON public.communications(user_id, response_status);