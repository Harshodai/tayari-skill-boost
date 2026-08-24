#!/usr/bin/env bash
# Fail closed if a public-table migration is shipped without row-level security
# or if known sensitive tables regain direct browser-role privileges.
set -euo pipefail

compose_bin=(docker compose)

"${compose_bin[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL'
DO $$
DECLARE
    missing_rls TEXT;
    exposed_sensitive TEXT;
    missing_owner_policy TEXT;
BEGIN
    SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO missing_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity;

    IF missing_rls IS NOT NULL THEN
        RAISE EXCEPTION 'public tables without RLS: %', missing_rls;
    END IF;

    SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO exposed_sensitive
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname = ANY (ARRAY['api_keys', 'oauth_states', 'password_reset_tokens'])
      AND (
          has_table_privilege('anon', c.oid, 'SELECT')
          OR has_table_privilege('anon', c.oid, 'INSERT')
          OR has_table_privilege('authenticated', c.oid, 'SELECT')
          OR has_table_privilege('authenticated', c.oid, 'INSERT')
      );

    IF exposed_sensitive IS NOT NULL THEN
        RAISE EXCEPTION 'sensitive tables have direct anon/authenticated grants: %', exposed_sensitive;
    END IF;

    SELECT string_agg(required.table_name, ', ' ORDER BY required.table_name)
    INTO missing_owner_policy
    FROM (VALUES ('applications'), ('agent_runs'), ('interview_sessions')) AS required(table_name)
    WHERE to_regclass('public.' || required.table_name) IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM pg_policies p
          WHERE p.schemaname = 'public'
            AND p.tablename = required.table_name
            AND p.roles @> ARRAY['authenticated']::name[]
      );

    IF missing_owner_policy IS NOT NULL THEN
        RAISE EXCEPTION 'required authenticated owner policies are missing: %', missing_owner_policy;
    END IF;
END $$;
SQL

echo "Public-table RLS gate passed."
