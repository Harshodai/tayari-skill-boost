-- Forward migration: fix unique constraint to include type column so debit+refund can share reference_id
DROP INDEX IF EXISTS public.uq_credit_ledger_user_reference;

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_user_reference_type
    ON public.credit_ledger (user_id, reference_id, type)
    WHERE reference_id IS NOT NULL;
