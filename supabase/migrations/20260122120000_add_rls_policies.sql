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
