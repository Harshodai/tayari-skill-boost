-- ==========================================
-- 2026-06-26: Multi-Tenant Enterprise Schema
-- Adds support for multi-tenant colleges/bootcamps and cohort groups.
-- ==========================================

-- 1. tenants
CREATE TABLE IF NOT EXISTS public.tenants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    domain        VARCHAR(255) UNIQUE NOT NULL,
    logo_url      TEXT,
    primary_color VARCHAR(50) DEFAULT '#6366f1',
    secondary_color VARCHAR(50) DEFAULT '#4f46e5',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. cohorts
CREATE TABLE IF NOT EXISTS public.cohorts (
    id         SERIAL PRIMARY KEY,
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cohorts_tenant ON public.cohorts(tenant_id);

-- 3. memberships
CREATE TABLE IF NOT EXISTS public.memberships (
    id         SERIAL PRIMARY KEY,
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'advisor', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON public.memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);

-- 4. Alter profiles to link tenant and cohort
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cohort_id INTEGER REFERENCES public.cohorts(id) ON DELETE SET NULL;

-- 5. Web-push notifications subscription table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
