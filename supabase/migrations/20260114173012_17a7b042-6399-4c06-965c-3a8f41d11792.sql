-- Create auth_attempts table for rate limiting
CREATE TABLE public.auth_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_hash TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_auth_attempts_email ON public.auth_attempts (email);
CREATE INDEX idx_auth_attempts_blocked_until ON public.auth_attempts (blocked_until) WHERE blocked_until IS NOT NULL;

-- Enable RLS
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions)
-- No public access policies - handled by edge function with service role

-- Create function to clean up old attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_auth_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auth_attempts
  WHERE last_attempt_at < now() - INTERVAL '24 hours';
END;
$$;