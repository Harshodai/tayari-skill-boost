-- Fix: refresh_user_preference_summary() has been failing on every call
-- since it was introduced in 20260731_social_privacy_preferences.sql:203.
--
-- Root cause: the function was created WITHOUT `SECURITY DEFINER`, so it
-- runs as whatever role calls it -- in production that's `postgres`, the
-- role both Go and Python connect as. `REFRESH MATERIALIZED VIEW` requires
-- ownership of the view (or superuser), and the view
-- `public.user_preference_summary` is owned by `supabase_admin` (the real
-- privileged role in the supabase/postgres image -- `postgres` is not a
-- superuser there, see the 2026-08-25 backup/restore-drill and
-- memory_correction_controls lessons). So every call raises:
--   ERROR: must be owner of materialized view user_preference_summary
-- and 20260825130000_memory_correction_controls.sql's `DROP MATERIALIZED
-- VIEW` + `CREATE MATERIALIZED VIEW` made this worse: the recreated view
-- starts with zero refreshed rows, and since it can never be refreshed
-- (same ownership problem), it stays empty forever.
--
-- app/services/preference_learning.py's `_refresh_summary_view()` catches
-- and swallows the resulting exception by design ("Never raises" is in
-- its own module docstring), so this failure has been completely silent:
-- `preferred_titles` / `preferred_companies` / counts stay empty for every
-- user, and the frontend's MemoryBadge.tsx (whose own comment calls this
-- "the one moat zero competitors have") never renders.
--
-- Fix: mark the function SECURITY DEFINER so it runs with its owner's
-- (supabase_admin's) privileges regardless of caller. Per Postgres's
-- SECURITY DEFINER hardening guidance, an unpinned search_path on a
-- SECURITY DEFINER function is itself a privilege-escalation vector
-- (search_path hijacking), so pin it to `public, pg_temp` in the same
-- statement.
ALTER FUNCTION public.refresh_user_preference_summary()
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- One-time catch-up refresh: feedback rows recorded while the refresh was
-- silently failing (or since the view was recreated with zero rows) should
-- be reflected immediately rather than waiting for the next scheduled
-- preference-learning run.
SELECT public.refresh_user_preference_summary();
