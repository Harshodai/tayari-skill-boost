-- Enable RBAC and Security Hardening

-- 1. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'moderator')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Only service role can manage roles (for now)
CREATE POLICY "Service role manages roles" ON public.user_roles
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- 2. Create Security Definer Function to check roles
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_has_role BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = required_role
    ) INTO user_has_role;
    
    RETURN user_has_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update RLS Policies for Profiles (Strict)
DROP POLICY IF EXISTS "Public profiles access" ON public.profiles;

-- Allow public read of profiles? Let's restrict it to authenticated for now based on requirements, 
-- or stick to the previous "Users can view own profile".
-- Requirement: "Prevent privilege escalation", "Secure profiles".
-- We'll keep: Authenticated users can view their own profile.
-- If public profiles are needed (e.g. for comments), we 'd need a separate policy. 
-- For now, sticking to strict owner-access.

-- 4. Blog Posts Security
-- Requirement: "Add proper RLS policies for blog_posts"
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Everyone can read published blog posts; drafts and future posts stay private.
DROP POLICY IF EXISTS "Public can read blog posts" ON public.blog_posts;
CREATE POLICY "Public can read published blog posts" ON public.blog_posts
    FOR SELECT TO public
    USING (published_at IS NOT NULL AND published_at <= now());

-- Only admins can Create/Update/Delete blog posts
CREATE POLICY "Admins can manage blog posts" ON public.blog_posts
    FOR ALL TO authenticated
    USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

-- 5. Resume Analyses Security
-- Enforce non-nullable user_id (it is already defined as such in types.ts but good to enforce in SQL if not)
-- ALTER TABLE public.resume_analyses ALTER COLUMN user_id SET NOT NULL; -- Already enforced by schema usually

-- Ensure Policy is strict (Refining previous migration)
DROP POLICY IF EXISTS "Users can view own analyses" ON public.resume_analyses;
CREATE POLICY "Users can view own analyses" ON public.resume_analyses
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own analyses" ON public.resume_analyses;
CREATE POLICY "Users can insert own analyses" ON public.resume_analyses
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own analyses" ON public.resume_analyses;
CREATE POLICY "Users can update own analyses" ON public.resume_analyses
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own analyses" ON public.resume_analyses;
CREATE POLICY "Users can delete own analyses" ON public.resume_analyses
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
    
-- 6. User Achievements Security
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements" ON public.user_achievements
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- System (service role) usually gives achievements, but if we allow users to claim them:
-- For now, assume mainly system driven or own-insert if tailored that way.
-- Let's allow users to read/delete own. Insert/Update might be restricted to system functions or specific flows.
-- Safest: Users can read own. 
