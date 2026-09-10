-- shared_interview_questions moderation columns + report tracking.
-- Referenced by backend/go/internal/api/routes_social_moderation.go
-- (handleListPendingInterviewQuestions, handleModerateInterviewQuestion,
-- handleReportInterviewQuestion) but never had a migration.

ALTER TABLE shared_interview_questions
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by UUID,
  ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0;

ALTER TABLE shared_interview_questions
  DROP CONSTRAINT IF EXISTS shared_interview_questions_moderation_status_check;
ALTER TABLE shared_interview_questions
  ADD CONSTRAINT shared_interview_questions_moderation_status_check
  CHECK (moderation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));

CREATE INDEX IF NOT EXISTS idx_siq_moderation_status ON shared_interview_questions(moderation_status);

CREATE TABLE IF NOT EXISTS interview_question_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES shared_interview_questions(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (question_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_iqr_question_id ON interview_question_reports(question_id);
ALTER TABLE interview_question_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can report questions" ON interview_question_reports;
CREATE POLICY "Users can report questions" ON interview_question_reports
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can see own reports" ON interview_question_reports;
CREATE POLICY "Users can see own reports" ON interview_question_reports
    FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

GRANT SELECT, INSERT ON interview_question_reports TO authenticated;
GRANT ALL ON interview_question_reports TO service_role;
