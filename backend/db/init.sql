-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Emulate Supabase Auth Schema
-- ==========================================
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    aud character varying(255),
    role character varying(255),
    email character varying(255) UNIQUE,
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone character varying(255) UNIQUE,
    phone_confirmed_at timestamp with time zone,
    phone_change character varying(255),
    phone_change_token character varying(255),
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    email_change_token_current character varying(255),
    email_change_confirm_status smallint,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255),
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false,
    deleted_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users (instance_id);

-- Helper function to simulate auth.uid() for RLS
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
    SELECT current_setting('request.jwt.claim.sub', true)::uuid;
$$ LANGUAGE SQL STABLE;

-- ==========================================
-- 2. Create Public Tables
-- ==========================================

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at timestamp with time zone,
    full_name text,
    avatar_url text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin', 'user', 'moderator')),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, role)
);

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
    read_time_minutes integer,
    prompts_used jsonb,
    outcomes jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

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

-- AUTH ATTEMPTS
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL UNIQUE,
    ip_hash text,
    attempt_count integer DEFAULT 1 NOT NULL,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- USER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type text NOT NULL,
    metadata jsonb,
    achieved_at timestamp with time zone DEFAULT now()
);

-- USER STREAKS
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    last_activity_date timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


-- ==========================================
-- 3. Security Definer Functions
-- ==========================================

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
