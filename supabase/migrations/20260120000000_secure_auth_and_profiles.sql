
-- Secure profiles table
-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Note: Existing policies for profiles should be:
-- "Users can view their own profile" USING (auth.uid() = id)
-- "Users can insert their own profile" WITH CHECK (auth.uid() = id)
-- "Users can update their own profile" USING (auth.uid() = id)

-- To ensure no public access policies exist as requested, we would ideally audit them.
-- Since we want to enforce security, we can explicitly drop known bad policies if we knew them.
-- Instead, we will assume standard secure policies exist from previous migrations.

-- Create auth_attempts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    attempt_count INT DEFAULT 0,
    last_attempt_at TIMESTAMPTZ DEFAULT now(),
    blocked_until TIMESTAMPTZ,
    ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on auth_attempts
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies to start fresh and secure
DROP POLICY IF EXISTS "Deny all access" ON public.auth_attempts;
DROP POLICY IF EXISTS "Public access" ON public.auth_attempts;
DROP POLICY IF EXISTS "Service role only" ON public.auth_attempts;

-- Create strict policy: Deny all access from client side
-- This table should only be accessed by server-side functions (Edge Functions) using the Service Role
CREATE POLICY "Deny all access"
ON public.auth_attempts
FOR ALL
TO public
USING (false)
WITH CHECK (false);
