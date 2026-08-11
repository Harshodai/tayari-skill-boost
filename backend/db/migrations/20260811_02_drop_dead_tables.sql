-- 20260811_02_drop_dead_tables.sql
-- B7 cleanup: drop 7 DB tables with zero application-code references.
-- Audit (JobTayari_Production_Readiness_and_Moat.md B7) identified these as dead
-- surface. Verified 2026-08-11 via grep across backend/, src/, integrations/,
-- extension/ — the only hits were the original table DDL definitions and the security
-- baseline.json (a scanner artifact, not a consumer). No Go/Python/TS code reads
-- or writes any of these tables. No foreign keys reference them.
--
-- Dropping with CASCADE for safety (drops any dependent views/indexes that may
-- have been added out-of-band). This is irreversible — if a table turns out to be
-- needed, restore from the migration that created it and re-run.
--
-- Tables dropped (creation migration in parentheses):
--   application_attempts  (20260620_hermes_agents.sql)
--   interview_messages   (20260625_voice_interview.sql)
--   learning_resources   (20260625_career_intelligence.sql)
--   platform_configs      (20260620_hermes_agents.sql)
--   tailored_resumes      (20260620_hermes_agents.sql)
--   user_sessions         (20260620_hermes_agents.sql)
--   voice_note_files       (20260625_archive_integration.sql)

DROP TABLE IF EXISTS public.application_attempts CASCADE;
DROP TABLE IF EXISTS public.interview_messages CASCADE;
DROP TABLE IF EXISTS public.learning_resources CASCADE;
DROP TABLE IF EXISTS public.platform_configs CASCADE;
DROP TABLE IF EXISTS public.tailored_resumes CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.voice_note_files CASCADE;