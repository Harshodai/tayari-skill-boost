-- ==========================================
-- 2026-07-31: Direction-agnostic unique constraint on public.connections
--
-- public.connections has UNIQUE(requester_id, addressee_id) — an ordered
-- pair — plus an application-level pre-check in handleSendConnectionRequest
-- (backend/go/internal/api/routes_social.go) that SELECTs for either
-- direction before INSERTing, explicitly commented there as a "second line
-- of defense" against races. But under READ COMMITTED, two concurrent
-- requests — A->B and B->A — can both pass that SELECT before either INSERT
-- commits: (A,B) and (B,A) are different tuples under the ordered
-- constraint, so neither INSERT trips a unique_violation, and two connection
-- rows end up existing between the same two users. This adds a real
-- DB-level direction-agnostic unique index to close that TOCTOU race.
-- handleSendConnectionRequest's existing `case "23505":` branch already
-- returns 409 "Connection already exists" for ANY unique_violation on this
-- table regardless of which constraint/index fired, so no Go code change is
-- needed to handle the new index's violations.
-- ==========================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_pair_unique
    ON public.connections (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
