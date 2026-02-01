-- ==========================================
-- Tayari Skill Boost - Database Schema
-- For Self-Hosted Supabase
-- ==========================================

-- Note: auth.users is already created by Supabase
-- We only need to create public tables

-- ==========================================
-- 1. Core Tables
-- ==========================================

-- PROFILES (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at timestamp with time zone,
    full_name text,
    avatar_url text,
    email text,
    location text DEFAULT 'Hyderabad, India',
    title text DEFAULT 'Career Professional',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- USER ROLES (for RBAC)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin', 'user', 'moderator')),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- ==========================================
-- 2. Resume & Job Tables
-- ==========================================

-- RESUME ANALYSES
CREATE TABLE IF NOT EXISTS public.resume_analyses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_text text,
    resume_filename text NOT NULL,
    job_description text,
    job_title text,
    company_name text,
    analysis_data jsonb NOT NULL,
    overall_score double precision NOT NULL,
    parsed_resume jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resume_analyses_user_id ON public.resume_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_created_at ON public.resume_analyses(created_at DESC);

-- ==========================================
-- 3. Blog & Content Tables
-- ==========================================

-- BLOG POSTS
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    content text NOT NULL,
    excerpt text NOT NULL,
    featured_image text,
    category text NOT NULL,
    tags text[],
    author_name text,
    published_at timestamp with time zone,
    is_featured boolean DEFAULT false,
    is_success_story boolean DEFAULT false,
    is_published boolean DEFAULT false,
    read_time_minutes integer,
    prompts_used jsonb,
    outcomes jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category);

-- ==========================================
-- 4. Gamification Tables
-- ==========================================

-- USER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type text NOT NULL,
    metadata jsonb,
    achieved_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);

-- USER STREAKS
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    last_activity_date timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 5. Security Tables
-- ==========================================

-- AUTH ATTEMPTS (for rate limiting)
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL UNIQUE,
    ip_hash text,
    attempt_count integer DEFAULT 1 NOT NULL,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_email ON public.auth_attempts(email);

-- ==========================================
-- 6. Social Features Tables
-- ==========================================

-- FRIENDSHIPS
CREATE TABLE IF NOT EXISTS public.friendships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);

-- ==========================================
-- 7. Helper Functions
-- ==========================================

-- Check if user has a specific role
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. Row Level Security (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- PROFILES Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RESUME ANALYSES Policies
CREATE POLICY "Users can view own analyses" ON public.resume_analyses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analyses" ON public.resume_analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON public.resume_analyses
    FOR DELETE USING (auth.uid() = user_id);

-- BLOG POSTS Policies (public read, admin write)
CREATE POLICY "Anyone can view published posts" ON public.blog_posts
    FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage posts" ON public.blog_posts
    FOR ALL USING (public.has_role('admin'));

-- USER ACHIEVEMENTS Policies
CREATE POLICY "Users can view own achievements" ON public.user_achievements
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert achievements" ON public.user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- USER STREAKS Policies
CREATE POLICY "Users can view own streaks" ON public.user_streaks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage streaks" ON public.user_streaks
    FOR ALL USING (auth.uid() = user_id);

-- FRIENDSHIPS Policies
CREATE POLICY "Users can view own friendships" ON public.friendships
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can manage own friendships" ON public.friendships
    FOR ALL USING (auth.uid() = user_id);

-- AUTH ATTEMPTS Policies (service role only - backend access)
CREATE POLICY "Service role can manage auth attempts" ON public.auth_attempts
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Backend can insert auth attempts" ON public.auth_attempts
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Backend can update auth attempts" ON public.auth_attempts
    FOR UPDATE USING (true);
CREATE POLICY "Backend can delete auth attempts" ON public.auth_attempts
    FOR DELETE USING (true);

-- ==========================================
-- 9. Triggers for Auto-Updates
-- ==========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profiles_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_blog_posts_update
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_friendships_update
    BEFORE UPDATE ON public.friendships
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    -- Also create default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Initialize streak
    INSERT INTO public.user_streaks (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on new user
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
