-- Forward hardening migration for the critical public-table RLS findings.
-- User-owned tables are scoped to auth.uid(); service-only tables are
-- inaccessible to anon/authenticated roles; blog_posts exposes published content.
-- Apply first in a disposable Supabase/PostgreSQL environment and run two-user gateway tests.

ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.application_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.application_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_skill_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_skill_analyses FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interview_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voice_note_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voice_note_files FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oauth_states FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hermes_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hermes_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.privacy_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.privacy_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_portals FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_router_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_router_events FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.source_chunks FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.runtime_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.runtime_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tailored_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tailored_resumes FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.digital_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.digital_employees FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_task_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_task_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.review_queue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.review_queue_history FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.application_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.application_outcomes FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.question_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.question_upvotes FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.communications FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shared_interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shared_interview_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_job_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_job_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roadmap_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roadmap_progress FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resume_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resume_analyses FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_achievements FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_streaks FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resume_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resume_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_usage FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interview_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.autopilot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.autopilot_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.learning_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cohorts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ab_testing_bandit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ab_testing_bandit FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_action_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_action_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.connections FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interview_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interview_scores FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scraped_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scraped_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.candidate_agent_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.candidate_agent_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resume_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resume_graphs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gmail_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_embeddings FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.candidate_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.candidate_verification FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blog_posts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.resume_variants FROM anon, authenticated;
GRANT ALL ON TABLE public.resume_variants TO service_role;
DROP POLICY IF EXISTS resume_variants_service_only ON public.resume_variants;
CREATE POLICY resume_variants_service_only ON public.resume_variants
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.api_usage FROM anon, authenticated;
GRANT ALL ON TABLE public.api_usage TO service_role;
DROP POLICY IF EXISTS api_usage_service_only ON public.api_usage;
CREATE POLICY api_usage_service_only ON public.api_usage
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.interview_messages FROM anon, authenticated;
GRANT ALL ON TABLE public.interview_messages TO service_role;
DROP POLICY IF EXISTS interview_messages_service_only ON public.interview_messages;
CREATE POLICY interview_messages_service_only ON public.interview_messages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.autopilot_runs FROM anon, authenticated;
GRANT ALL ON TABLE public.autopilot_runs TO service_role;
DROP POLICY IF EXISTS autopilot_runs_service_only ON public.autopilot_runs;
CREATE POLICY autopilot_runs_service_only ON public.autopilot_runs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.tenants FROM anon, authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;
DROP POLICY IF EXISTS tenants_service_only ON public.tenants;
CREATE POLICY tenants_service_only ON public.tenants
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.learning_resources FROM anon, authenticated;
GRANT ALL ON TABLE public.learning_resources TO service_role;
DROP POLICY IF EXISTS learning_resources_service_only ON public.learning_resources;
CREATE POLICY learning_resources_service_only ON public.learning_resources
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.cohorts FROM anon, authenticated;
GRANT ALL ON TABLE public.cohorts TO service_role;
DROP POLICY IF EXISTS cohorts_service_only ON public.cohorts;
CREATE POLICY cohorts_service_only ON public.cohorts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.ab_testing_bandit FROM anon, authenticated;
GRANT ALL ON TABLE public.ab_testing_bandit TO service_role;
DROP POLICY IF EXISTS ab_testing_bandit_service_only ON public.ab_testing_bandit;
CREATE POLICY ab_testing_bandit_service_only ON public.ab_testing_bandit
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.agent_action_approvals FROM anon, authenticated;
GRANT ALL ON TABLE public.agent_action_approvals TO service_role;
DROP POLICY IF EXISTS agent_action_approvals_service_only ON public.agent_action_approvals;
CREATE POLICY agent_action_approvals_service_only ON public.agent_action_approvals
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.connections FROM anon, authenticated;
GRANT ALL ON TABLE public.connections TO service_role;
DROP POLICY IF EXISTS connections_service_only ON public.connections;
CREATE POLICY connections_service_only ON public.connections
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.interview_scores FROM anon, authenticated;
GRANT ALL ON TABLE public.interview_scores TO service_role;
DROP POLICY IF EXISTS interview_scores_service_only ON public.interview_scores;
CREATE POLICY interview_scores_service_only ON public.interview_scores
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.scraped_jobs FROM anon, authenticated;
GRANT ALL ON TABLE public.scraped_jobs TO service_role;
DROP POLICY IF EXISTS scraped_jobs_service_only ON public.scraped_jobs;
CREATE POLICY scraped_jobs_service_only ON public.scraped_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.candidate_agent_audit_logs FROM anon, authenticated;
GRANT ALL ON TABLE public.candidate_agent_audit_logs TO service_role;
DROP POLICY IF EXISTS candidate_agent_audit_logs_service_only ON public.candidate_agent_audit_logs;
CREATE POLICY candidate_agent_audit_logs_service_only ON public.candidate_agent_audit_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.resume_graphs FROM anon, authenticated;
GRANT ALL ON TABLE public.resume_graphs TO service_role;
DROP POLICY IF EXISTS resume_graphs_service_only ON public.resume_graphs;
CREATE POLICY resume_graphs_service_only ON public.resume_graphs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.gmail_tokens FROM anon, authenticated;
GRANT ALL ON TABLE public.gmail_tokens TO service_role;
DROP POLICY IF EXISTS gmail_tokens_service_only ON public.gmail_tokens;
CREATE POLICY gmail_tokens_service_only ON public.gmail_tokens
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.document_embeddings FROM anon, authenticated;
GRANT ALL ON TABLE public.document_embeddings TO service_role;
DROP POLICY IF EXISTS document_embeddings_service_only ON public.document_embeddings;
CREATE POLICY document_embeddings_service_only ON public.document_embeddings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.candidate_verification FROM anon, authenticated;
GRANT ALL ON TABLE public.candidate_verification TO service_role;
DROP POLICY IF EXISTS candidate_verification_service_only ON public.candidate_verification;
CREATE POLICY candidate_verification_service_only ON public.candidate_verification
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.conversations FROM anon, authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversations TO authenticated;
DROP POLICY IF EXISTS conversations_owner ON public.conversations;
CREATE POLICY conversations_owner ON public.conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.application_attempts FROM anon, authenticated;
GRANT ALL ON TABLE public.application_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.application_attempts TO authenticated;
DROP POLICY IF EXISTS application_attempts_owner ON public.application_attempts;
CREATE POLICY application_attempts_owner ON public.application_attempts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_skill_analyses FROM anon, authenticated;
GRANT ALL ON TABLE public.user_skill_analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_skill_analyses TO authenticated;
DROP POLICY IF EXISTS user_skill_analyses_owner ON public.user_skill_analyses;
CREATE POLICY user_skill_analyses_owner ON public.user_skill_analyses
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_sessions FROM anon, authenticated;
GRANT ALL ON TABLE public.user_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_sessions TO authenticated;
DROP POLICY IF EXISTS user_sessions_owner ON public.user_sessions;
CREATE POLICY user_sessions_owner ON public.user_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.interview_sessions FROM anon, authenticated;
GRANT ALL ON TABLE public.interview_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.interview_sessions TO authenticated;
DROP POLICY IF EXISTS interview_sessions_owner ON public.interview_sessions;
CREATE POLICY interview_sessions_owner ON public.interview_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.voice_note_files FROM anon, authenticated;
GRANT ALL ON TABLE public.voice_note_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.voice_note_files TO authenticated;
DROP POLICY IF EXISTS voice_note_files_owner ON public.voice_note_files;
CREATE POLICY voice_note_files_owner ON public.voice_note_files
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.oauth_states FROM anon, authenticated;
GRANT ALL ON TABLE public.oauth_states TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.oauth_states TO authenticated;
DROP POLICY IF EXISTS oauth_states_owner ON public.oauth_states;
CREATE POLICY oauth_states_owner ON public.oauth_states
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.saved_posts FROM anon, authenticated;
GRANT ALL ON TABLE public.saved_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_posts TO authenticated;
DROP POLICY IF EXISTS saved_posts_owner ON public.saved_posts;
CREATE POLICY saved_posts_owner ON public.saved_posts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.hermes_sessions FROM anon, authenticated;
GRANT ALL ON TABLE public.hermes_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hermes_sessions TO authenticated;
DROP POLICY IF EXISTS hermes_sessions_owner ON public.hermes_sessions;
CREATE POLICY hermes_sessions_owner ON public.hermes_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;
DROP POLICY IF EXISTS push_subscriptions_owner ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.privacy_audit_log FROM anon, authenticated;
GRANT ALL ON TABLE public.privacy_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.privacy_audit_log TO authenticated;
DROP POLICY IF EXISTS privacy_audit_log_owner ON public.privacy_audit_log;
CREATE POLICY privacy_audit_log_owner ON public.privacy_audit_log
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_portals FROM anon, authenticated;
GRANT ALL ON TABLE public.user_portals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_portals TO authenticated;
DROP POLICY IF EXISTS user_portals_owner ON public.user_portals;
CREATE POLICY user_portals_owner ON public.user_portals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.agent_router_events FROM anon, authenticated;
GRANT ALL ON TABLE public.agent_router_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_router_events TO authenticated;
DROP POLICY IF EXISTS agent_router_events_owner ON public.agent_router_events;
CREATE POLICY agent_router_events_owner ON public.agent_router_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.source_chunks FROM anon, authenticated;
GRANT ALL ON TABLE public.source_chunks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.source_chunks TO authenticated;
DROP POLICY IF EXISTS source_chunks_owner ON public.source_chunks;
CREATE POLICY source_chunks_owner ON public.source_chunks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.memberships FROM anon, authenticated;
GRANT ALL ON TABLE public.memberships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.memberships TO authenticated;
DROP POLICY IF EXISTS memberships_owner ON public.memberships;
CREATE POLICY memberships_owner ON public.memberships
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.agent_tasks FROM anon, authenticated;
GRANT ALL ON TABLE public.agent_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_tasks TO authenticated;
DROP POLICY IF EXISTS agent_tasks_owner ON public.agent_tasks;
CREATE POLICY agent_tasks_owner ON public.agent_tasks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.platform_configs FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_configs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_configs TO authenticated;
DROP POLICY IF EXISTS platform_configs_owner ON public.platform_configs;
CREATE POLICY platform_configs_owner ON public.platform_configs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.runtime_approvals FROM anon, authenticated;
GRANT ALL ON TABLE public.runtime_approvals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.runtime_approvals TO authenticated;
DROP POLICY IF EXISTS runtime_approvals_owner ON public.runtime_approvals;
CREATE POLICY runtime_approvals_owner ON public.runtime_approvals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.agent_runs FROM anon, authenticated;
GRANT ALL ON TABLE public.agent_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_runs TO authenticated;
DROP POLICY IF EXISTS agent_runs_owner ON public.agent_runs;
CREATE POLICY agent_runs_owner ON public.agent_runs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.tailored_resumes FROM anon, authenticated;
GRANT ALL ON TABLE public.tailored_resumes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tailored_resumes TO authenticated;
DROP POLICY IF EXISTS tailored_resumes_owner ON public.tailored_resumes;
CREATE POLICY tailored_resumes_owner ON public.tailored_resumes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.digital_employees FROM anon, authenticated;
GRANT ALL ON TABLE public.digital_employees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.digital_employees TO authenticated;
DROP POLICY IF EXISTS digital_employees_owner ON public.digital_employees;
CREATE POLICY digital_employees_owner ON public.digital_employees
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.agent_task_attempts FROM anon, authenticated;
GRANT ALL ON TABLE public.agent_task_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_task_attempts TO authenticated;
DROP POLICY IF EXISTS agent_task_attempts_owner ON public.agent_task_attempts;
CREATE POLICY agent_task_attempts_owner ON public.agent_task_attempts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.review_queue_history FROM anon, authenticated;
GRANT ALL ON TABLE public.review_queue_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.review_queue_history TO authenticated;
DROP POLICY IF EXISTS review_queue_history_owner ON public.review_queue_history;
CREATE POLICY review_queue_history_owner ON public.review_queue_history
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.saved_sources FROM anon, authenticated;
GRANT ALL ON TABLE public.saved_sources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_sources TO authenticated;
DROP POLICY IF EXISTS saved_sources_owner ON public.saved_sources;
CREATE POLICY saved_sources_owner ON public.saved_sources
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.application_outcomes FROM anon, authenticated;
GRANT ALL ON TABLE public.application_outcomes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.application_outcomes TO authenticated;
DROP POLICY IF EXISTS application_outcomes_owner ON public.application_outcomes;
CREATE POLICY application_outcomes_owner ON public.application_outcomes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.question_upvotes FROM anon, authenticated;
GRANT ALL ON TABLE public.question_upvotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_upvotes TO authenticated;
DROP POLICY IF EXISTS question_upvotes_owner ON public.question_upvotes;
CREATE POLICY question_upvotes_owner ON public.question_upvotes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.communications FROM anon, authenticated;
GRANT ALL ON TABLE public.communications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.communications TO authenticated;
DROP POLICY IF EXISTS communications_owner ON public.communications;
CREATE POLICY communications_owner ON public.communications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.shared_interview_questions FROM anon, authenticated;
GRANT ALL ON TABLE public.shared_interview_questions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shared_interview_questions TO authenticated;
DROP POLICY IF EXISTS shared_interview_questions_owner ON public.shared_interview_questions;
CREATE POLICY shared_interview_questions_owner ON public.shared_interview_questions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.password_reset_tokens FROM anon, authenticated;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.password_reset_tokens TO authenticated;
DROP POLICY IF EXISTS password_reset_tokens_owner ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_owner ON public.password_reset_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.api_keys FROM anon, authenticated;
GRANT ALL ON TABLE public.api_keys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_keys TO authenticated;
DROP POLICY IF EXISTS api_keys_owner ON public.api_keys;
CREATE POLICY api_keys_owner ON public.api_keys
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_job_feedback FROM anon, authenticated;
GRANT ALL ON TABLE public.user_job_feedback TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_job_feedback TO authenticated;
DROP POLICY IF EXISTS user_job_feedback_owner ON public.user_job_feedback;
CREATE POLICY user_job_feedback_owner ON public.user_job_feedback
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.roadmap_progress FROM anon, authenticated;
GRANT ALL ON TABLE public.roadmap_progress TO service_role;
GRANT SELECT ON TABLE public.roadmap_progress TO authenticated;
DROP POLICY IF EXISTS roadmap_progress_owner ON public.roadmap_progress;
CREATE POLICY roadmap_progress_owner ON public.roadmap_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.resume_analyses FROM anon, authenticated;
GRANT ALL ON TABLE public.resume_analyses TO service_role;
GRANT SELECT ON TABLE public.resume_analyses TO authenticated;
DROP POLICY IF EXISTS resume_analyses_owner ON public.resume_analyses;
CREATE POLICY resume_analyses_owner ON public.resume_analyses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.saved_jobs FROM anon, authenticated;
GRANT ALL ON TABLE public.saved_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_jobs TO authenticated;
DROP POLICY IF EXISTS saved_jobs_owner ON public.saved_jobs;
CREATE POLICY saved_jobs_owner ON public.saved_jobs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_achievements FROM anon, authenticated;
GRANT ALL ON TABLE public.user_achievements TO service_role;
GRANT SELECT ON TABLE public.user_achievements TO authenticated;
DROP POLICY IF EXISTS user_achievements_owner ON public.user_achievements;
CREATE POLICY user_achievements_owner ON public.user_achievements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_streaks FROM anon, authenticated;
GRANT ALL ON TABLE public.user_streaks TO service_role;
GRANT SELECT ON TABLE public.user_streaks TO authenticated;
DROP POLICY IF EXISTS user_streaks_owner ON public.user_streaks;
CREATE POLICY user_streaks_owner ON public.user_streaks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.blog_posts FROM anon, authenticated;
GRANT SELECT ON TABLE public.blog_posts TO anon, authenticated;
GRANT ALL ON TABLE public.blog_posts TO service_role;
DROP POLICY IF EXISTS blog_posts_published_read ON public.blog_posts;
CREATE POLICY blog_posts_published_read ON public.blog_posts
  FOR SELECT TO public
  USING (published_at IS NOT NULL AND published_at <= now());

-- No direct client access is granted to candidate_agent_audit_logs, gmail_tokens,
-- resume_graphs, document_embeddings, or candidate_verification. Their backend
-- paths use the service role and must retain owner predicates in application SQL.
