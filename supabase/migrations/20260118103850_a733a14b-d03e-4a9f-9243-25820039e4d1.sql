-- Add RLS policies for auth_attempts table
-- This table should ONLY be accessible by the service role (used by Edge Functions)
-- Regular users should never have access to this sensitive security data

-- Policy to deny all access for authenticated users
CREATE POLICY "Deny authenticated user access"
ON public.auth_attempts
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Policy to deny all access for anonymous users
CREATE POLICY "Deny anonymous user access"
ON public.auth_attempts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Service role automatically bypasses RLS, so no explicit policy needed
-- The check-rate-limit Edge Function uses service role credentials which bypass RLS