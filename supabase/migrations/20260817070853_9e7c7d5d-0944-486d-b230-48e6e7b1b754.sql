REVOKE EXECUTE ON FUNCTION public.cleanup_old_auth_attempts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_auth_attempts() TO service_role;