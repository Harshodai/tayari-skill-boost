
-- Deny all deletes on user_streaks (system-managed table)
CREATE POLICY "Deny all deletes on user_streaks"
ON public.user_streaks
FOR DELETE
TO authenticated, anon
USING (false);

-- Revoke EXECUTE on SECURITY DEFINER functions from public roles
REVOKE EXECUTE ON FUNCTION public.cleanup_old_auth_attempts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
