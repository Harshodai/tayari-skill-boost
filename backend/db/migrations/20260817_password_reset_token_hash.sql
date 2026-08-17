CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.password_reset_tokens
    ADD COLUMN IF NOT EXISTS token_hash TEXT;

UPDATE public.password_reset_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
    ON public.password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active
    ON public.password_reset_tokens(user_id, expires_at)
    WHERE used = false;

ALTER TABLE public.password_reset_tokens
    ALTER COLUMN token_hash SET NOT NULL;
ALTER TABLE public.password_reset_tokens
    DROP COLUMN IF EXISTS token;

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_tokens TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.password_reset_tokens_id_seq TO service_role;
