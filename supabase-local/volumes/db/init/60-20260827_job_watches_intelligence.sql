-- Two small additions backing "intelligent" job watches:
--   1. job_watches.last_match_count: the real number of jobs the standing
--      beat search actually found on its most recent run, so the Settings
--      UI can show a real count instead of a bare timestamp.
--   2. saved_searches.job_watch_id: links a Job Search page "Daily alerts"
--      saved search to the real, backend-polled job_watches row it now
--      creates (see saved_searches_parity.sql). Before this, alert_enabled
--      was a UI-only flag with no backend consumer at all.

BEGIN;

ALTER TABLE public.job_watches
  ADD COLUMN IF NOT EXISTS last_match_count INTEGER;

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS job_watch_id UUID REFERENCES public.job_watches(watch_id) ON DELETE SET NULL;

COMMIT;
