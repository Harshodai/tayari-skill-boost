# 0004 — Direct Connection Tenant Isolation via Transaction-Scoped Session Claims

Date: 2026-09-05

## Status
Accepted. Helper context manager `tenant_transaction(user_id)` implemented in `backend/python/app/services/db.py` and validated by automated tests (`backend/python/app/tests/test_tenant_isolation.py`).

## Context
When backend services (the Go API gateway or Python AI engine) connect directly to PostgreSQL via connection pools (such as `asyncpg`), they typically connect with a single service-level connection string. In default PostgreSQL or managed Supabase configurations, administrative roles (like `postgres` or `service_role`) hold the `BYPASSRLS` attribute.

Consequently, direct SQL queries bypass PostgreSQL Row Level Security (RLS) policies (`auth.uid() = user_id`) unless tenant boundaries are explicitly bridged. Relying solely on application-level `WHERE user_id = :user_id` filters creates a single point of failure where a forgotten predicate or flawed join could expose cross-tenant data.

Furthermore, Supabase RLS policies rely on `auth.uid()`, which reads the JSON Web Token claim from `current_setting('request.jwt.claim.sub', true)`. Without an active PostgREST/Supabase HTTP session, this setting defaults to `NULL` or empty in direct connection pools.

## Decision
1. **Transaction-Scoped Session Claims (`set_config(..., is_local=true)`)**:
   Implement a scoped transaction context manager (`tenant_transaction(user_id)`) in `backend/python/app/services/db.py`. Within an active transaction block, the helper executes:
   ```sql
   SELECT set_config('request.jwt.claim.sub', $1, true);
   ```
   Using `is_local = true` guarantees that the claim is strictly bound to the duration of the current transaction (equivalent to `SET LOCAL`, but supporting bind parameters). When the transaction commits or rolls back, the session setting is automatically discarded, preventing connection pool contamination across reused connections.

2. **Defense-in-Depth Query Invariant**:
   Application queries must continue to explicitly specify owner predicates (`WHERE user_id = :user_id`). The session claim serves as an authoritative secondary boundary rather than an excuse to omit explicit application filters.

3. **Restricted Application Role Migration Path (`NOBYPASSRLS`)**:
   To fully neutralize the `BYPASSRLS` risk in multi-tenant cloud deployments:
   - Create a dedicated database role `tayari_app` with `NOBYPASSRLS`.
   - Grant necessary DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on public tables to `tayari_app`.
   - Ensure the application connection string authenticates as `tayari_app`.
   - Combined with `SET LOCAL request.jwt.claim.sub`, PostgreSQL will enforce RLS policies natively on all queries executed by the application role, causing queries without valid tenant claims or matching records to return zero rows or fail.

## Consequences
- Direct pool connections now have a standardized mechanism to inject tenant context into PostgreSQL session state.
- Connection pooling remains safe against identity leakage because `SET LOCAL` resets at transaction boundary.
- Synthetic identities (`default_user`, `anonymous`, empty strings) are rejected before setting claims.
- The platform establishes a clear, backward-compatible bridge between direct-connection backend services and Supabase-native RLS security policies.
