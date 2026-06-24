-- ==========================================
-- 2026-06-25: Voice Interview AI Schema
-- Adds support for real-time voice interview sessions, message
-- history (both user and AI transcripts), and session scores.
-- Follows standard patterns: gen_random_uuid, TIMESTAMPTZ,
-- FK -> auth.users(id) ON DELETE CASCADE.
-- ==========================================

-- 1. interview_sessions
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id           uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_title   VARCHAR(255) NOT NULL,
    company      VARCHAR(100),
    started_at   TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_started ON public.interview_sessions(started_at DESC);

-- 2. interview_messages
CREATE TABLE IF NOT EXISTS public.interview_messages (
    id           SERIAL PRIMARY KEY,
    session_id   uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    sender       VARCHAR(10) CHECK (sender IN ('ai', 'user')) NOT NULL,
    text         TEXT NOT NULL,
    audio_path   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_messages_session ON public.interview_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_messages_created ON public.interview_messages(created_at ASC);

-- 3. interview_scores
CREATE TABLE IF NOT EXISTS public.interview_scores (
    session_id         uuid NOT NULL PRIMARY KEY REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    overall_score      INT NOT NULL,
    star_method_score  INT NOT NULL, -- Situation, Task, Action, Result compliance (0-100)
    filler_words_count INT NOT NULL,
    pace_wpm           INT NOT NULL, -- Pacing (Words Per Minute)
    clarity_score      INT NOT NULL, -- Grammatical/structure clarity (0-100)
    strengths          TEXT[] DEFAULT '{}',
    weaknesses         TEXT[] DEFAULT '{}',
    feedback           TEXT NOT NULL
);
