-- Security Hardening Migration
-- Addresses vulnerabilities in profiles, resume_analyses, and auth_attempts

-- 1. Profiles Table Security
-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Policy: Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Explicitly deny public access (redundant if no other policies exist, but satisfying the warning)
-- Depending on requirements, we might want public profiles. 
-- For now, we strictly follow the warning "Add explicit deny policies for public access" implies we might want to ensure it.
-- However, RLS by default denies everything not allowed.
-- We will just ensure no public policies exist.


-- 2. Resume Analyses Table Security
-- Ensure RLS is enabled
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own analyses
DROP POLICY IF EXISTS "Users can view own analyses" ON public.resume_analyses;
CREATE POLICY "Users can view own analyses"
ON public.resume_analyses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own analyses
DROP POLICY IF EXISTS "Users can insert own analyses" ON public.resume_analyses;
CREATE POLICY "Users can insert own analyses"
ON public.resume_analyses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own analyses
DROP POLICY IF EXISTS "Users can update own analyses" ON public.resume_analyses;
CREATE POLICY "Users can update own analyses"
ON public.resume_analyses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can delete their own analyses
DROP POLICY IF EXISTS "Users can delete own analyses" ON public.resume_analyses;
CREATE POLICY "Users can delete own analyses"
ON public.resume_analyses
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 3. Auth Attempts Table Security
-- Ensure RLS is enabled
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role only (for Edge Functions)
-- We strictly deny access to authenticated and anon users
DROP POLICY IF EXISTS "Service role only" ON public.auth_attempts;
CREATE POLICY "Service role only"
ON public.auth_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no other policies allow access
DROP POLICY IF EXISTS "Public access" ON public.auth_attempts;
DROP POLICY IF EXISTS "Authenticated access" ON public.auth_attempts;
