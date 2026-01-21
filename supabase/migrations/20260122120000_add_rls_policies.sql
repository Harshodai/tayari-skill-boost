-- Deny anonymous access to resume_analyses
CREATE POLICY "Deny anonymous access to resume_analyses"
ON resume_analyses
FOR ALL
TO anon
USING (false);

-- Add DELETE policy for user_achievements
CREATE POLICY "Users can delete own achievements"
ON user_achievements
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Deny all access to auth_attempts (except service_role)
CREATE POLICY "No access to auth_attempts"
ON auth_attempts
FOR ALL
TO public
USING (false);

-- Deny anonymous access to profiles (prevent email exposure)
CREATE POLICY "No anon access to profiles"
ON profiles
FOR ALL
TO anon
USING (false);
