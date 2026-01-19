-- Secure user_achievements table - achievements should only be granted server-side
-- Drop existing policies if any and recreate with proper security
DROP POLICY IF EXISTS "Deny all inserts on user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Deny all updates on user_achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;

-- Users can only view their own achievements
CREATE POLICY "Users can view own achievements"
ON public.user_achievements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Deny all INSERT operations from client (achievements granted server-side only via service role)
CREATE POLICY "Deny all inserts on user_achievements"
ON public.user_achievements
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Deny all UPDATE operations from client
CREATE POLICY "Deny all updates on user_achievements"
ON public.user_achievements
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Secure user_streaks table similarly
DROP POLICY IF EXISTS "Deny all inserts on user_streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Deny all updates on user_streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can view own streaks" ON public.user_streaks;

-- Users can only view their own streaks
CREATE POLICY "Users can view own streaks"
ON public.user_streaks
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Deny all INSERT operations from client
CREATE POLICY "Deny all inserts on user_streaks"
ON public.user_streaks
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Deny all UPDATE operations from client
CREATE POLICY "Deny all updates on user_streaks"
ON public.user_streaks
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);