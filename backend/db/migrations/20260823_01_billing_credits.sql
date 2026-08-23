-- Durable credit balances and ledger for one-time Stripe credit packs.
CREATE TABLE IF NOT EXISTS public.user_credits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_purchased INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_purchased >= 0),
    lifetime_used INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_used >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount <> 0),
    type TEXT NOT NULL CHECK (type IN ('purchase', 'debit', 'refund', 'grant')),
    description TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
    ON public.credit_ledger (user_id, created_at DESC);

-- A payment or receipt reference can fulfill a user only once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_user_reference
    ON public.credit_ledger (user_id, reference_id)
    WHERE reference_id IS NOT NULL;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_credits_deny_client ON public.user_credits;
CREATE POLICY user_credits_deny_client
    ON public.user_credits
    FOR ALL TO authenticated, anon
    USING (false)
    WITH CHECK (false);

DROP POLICY IF EXISTS credit_ledger_deny_client ON public.credit_ledger;
CREATE POLICY credit_ledger_deny_client
    ON public.credit_ledger
    FOR ALL TO authenticated, anon
    USING (false)
    WITH CHECK (false);

REVOKE ALL ON public.user_credits, public.credit_ledger FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_credits TO service_role;
GRANT SELECT, INSERT ON public.credit_ledger TO service_role;
