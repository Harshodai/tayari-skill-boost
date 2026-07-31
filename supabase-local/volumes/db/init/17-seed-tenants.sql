-- Default tenant rows (mirrors backend/db/init.sh's post-migration seed step
-- for the bare-Postgres path -- this is the Supabase-stack equivalent).
INSERT INTO public.tenants (id, name, domain, created_at)
SELECT gen_random_uuid(), 'Default', 'localhost', NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE domain = 'localhost');

INSERT INTO public.tenants (id, name, domain, created_at)
SELECT gen_random_uuid(), 'Localhost-IP', '127.0.0.1', NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE domain = '127.0.0.1');
