-- ==========================================
-- Week 3-4: Review Queue Schema
-- Adds review queue support to applications
-- ==========================================

-- Add review-specific columns to applications
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS review_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS dream_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_suggestion TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ DEFAULT NOW();

-- Create review queue index for fast querying
CREATE INDEX IF NOT EXISTS idx_applications_status_review
ON public.applications(user_id, status)
WHERE status = 'review';

-- Create index for dream company filtering
CREATE INDEX IF NOT EXISTS idx_applications_dream_score
ON public.applications(user_id, dream_score DESC)
WHERE status = 'review';

-- Review queue history log table (audit trail)
CREATE TABLE IF NOT EXISTS public.review_queue_history (
    id          SERIAL PRIMARY KEY,
    application_id uuid NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action      TEXT NOT NULL CHECK (action IN ('queued', 'approved', 'rejected', 'modified', 'submitted', 'skipped')),
    previous_status TEXT,
    new_status  TEXT,
    notes       TEXT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_history_app_id ON public.review_queue_history(application_id);
CREATE INDEX IF NOT EXISTS idx_review_history_user_id ON public.review_queue_history(user_id);

-- Function to auto-log review queue transitions
CREATE OR REPLACE FUNCTION public.log_review_queue_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.review_queue_history (
            application_id, user_id, action, previous_status, new_status, notes, created_at
        ) VALUES (
            NEW.application_id,
            NEW.user_id,
            CASE NEW.status
                WHEN 'review' THEN 'queued'
                WHEN 'applied' THEN 'submitted'
                WHEN 'saved' THEN 'approved'
                WHEN 'rejected' THEN 'rejected'
                ELSE 'modified'
            END,
            OLD.status,
            NEW.status,
            COALESCE(NEW.review_notes, 'Auto-transition'),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_review_queue_log'
    ) THEN
        CREATE TRIGGER trg_review_queue_log
        AFTER UPDATE ON public.applications
        FOR EACH ROW
        WHEN (OLD.status IS DISTINCT FROM NEW.status)
        EXECUTE FUNCTION public.log_review_queue_transition();
    END IF;
END $$;
