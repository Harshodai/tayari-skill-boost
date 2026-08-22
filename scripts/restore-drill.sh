#!/usr/bin/env bash
# Tayari Restore Drill — verify a backup actually restores.
#
# Restores the latest (or a specified) backup into a THROWAWAY database and
# verifies the key tables are present and queryable. NEVER run against
# production.
#
# Safety gates: refuses to run unless BACKUP_DRILL_MODE=true is exported.
# Requires a DEDICATED throwaway drill endpoint (SUPABASE_DB_DRILL_*) and
# rejects any drill target that matches the configured production endpoint.
# Also prompts the operator to confirm the target DB is a throwaway.
#
# Env:
#   BACKUP_DRILL_MODE            (REQUIRED = true — the safety gate)
#   SUPABASE_DB_DRILL_HOST       (REQUIRED for the drill — throwaway DB host)
#   SUPABASE_DB_DRILL_PORT       (REQUIRED for the drill — throwaway DB port)
#   SUPABASE_DB_DRILL_USER       (REQUIRED for the drill — throwaway DB user)
#   SUPABASE_DB_DRILL_PASSWORD   (REQUIRED for the drill — throwaway DB password)
#   SUPABASE_DB_DRILL_NAME       (REQUIRED for the drill — throwaway DB name)
#   SUPABASE_DB_HOST             (default: localhost — production endpoint, used
#                                 only for the production-match rejection)
#   SUPABASE_DB_PORT             (default: 54329 — production endpoint, used
#                                 only for the production-match rejection)
#   SUPABASE_DB_NAME             (default: postgres — production DB name, checked
#                                 when host:port already match)
#   BACKUP_DIR                   (default: ./backups)
#   BACKUP_FILE                  (optional: explicit .dump path; default = latest)
#
# Usage: BACKUP_DRILL_MODE=true ./scripts/restore-drill.sh [path/to/backup.dump]
#
# See docs/operations/backup-and-recovery.md for the full drill procedure.

set -euo pipefail

if [ "${DRY_RUN:-false}" = "true" ]; then
    echo "restore-drill plan: backup -> dedicated SUPABASE_DB_DRILL_* throwaway database"
    echo "restore-drill plan: production endpoint address/port comparison remains mandatory"
    echo "restore-drill plan: integrity and key-table verification runs after restore"
    echo "restore-drill plan: no backup or database was accessed"
    exit 0
fi

if [ "${BACKUP_DRILL_MODE:-}" != "true" ]; then
    echo "[restore-drill] REFUSING: BACKUP_DRILL_MODE is not 'true'." >&2
    echo "[restore-drill] This script restores a backup into a database and MUST NOT run against production." >&2
    echo "[restore-drill] Re-run with BACKUP_DRILL_MODE=true and the SUPABASE_DB_DRILL_* vars set to a THROWAWAY database." >&2
    exit 2
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
PROD_HOST="${SUPABASE_DB_HOST:-localhost}"
PROD_PORT="${SUPABASE_DB_PORT:-54329}"
PROD_NAME="${SUPABASE_DB_NAME:-postgres}"

# Resolve target backup file: explicit arg > BACKUP_FILE env > latest in BACKUP_DIR.
BACKUP_FILE="${BACKUP_FILE:-}"
POS_ARG=""
for arg in "$@"; do
    case "$arg" in
        --*) ;;
        *) [ -z "${POS_ARG}" ] && POS_ARG="$arg" ;;
    esac
done
if [ -n "${POS_ARG}" ]; then
    BACKUP_FILE="${POS_ARG}"
fi
if [ -z "${BACKUP_FILE}" ]; then
    BACKUP_FILE=$(ls -1t "${BACKUP_DIR}"/tayari_hosted_*.dump 2>/dev/null | head -n1 || true)
fi

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
    echo "[restore-drill] ERROR: no backup file found." >&2
    echo "[restore-drill]        pass one as the first arg, or set BACKUP_FILE, or have a tayari_hosted_*.dump in ${BACKUP_DIR}/" >&2
    exit 1
fi

# Drill connection: a dedicated SUPABASE_DB_DRILL_* namespace — the drill must
# target a THROWAWAY database. The generic SUPABASE_DB_* vars are production
# config and are never used for the drill connection.
DB_HOST="${SUPABASE_DB_DRILL_HOST:-}"
DB_PORT="${SUPABASE_DB_DRILL_PORT:-}"
DB_USER="${SUPABASE_DB_DRILL_USER:-}"
DB_NAME="${SUPABASE_DB_DRILL_NAME:-}"
if [ -z "${DB_HOST}" ] || [ -z "${DB_PORT}" ] || [ -z "${DB_USER}" ] || [ -z "${DB_NAME}" ]; then
    echo "[restore-drill] REFUSING: the drill requires a dedicated throwaway endpoint." >&2
    echo "[restore-drill]        set SUPABASE_DB_DRILL_HOST/PORT/USER/NAME (and SUPABASE_DB_DRILL_PASSWORD)." >&2
    echo "[restore-drill]        do NOT point SUPABASE_DB_* at production — the drill never uses it." >&2
    exit 2
fi
: "${SUPABASE_DB_DRILL_PASSWORD:?Set SUPABASE_DB_DRILL_PASSWORD (throwaway drill DB password)}"

# Production-endpoint rejection: resolve both DB_HOST and PROD_HOST to IPv4
# and IPv6 addresses, then compare every resolved address paired with the
# configured port. A single shared (address, port) pair means the drill
# target IS the production endpoint — refuse. The dedicated DRILL_*
# credential namespace is REQUIRED but never taken as proof of separation
# (a throwaway password does not prove a throwaway database). Resolution
# failures exit with the refusal status before prompting or running
# pg_restore so a misconfigured drill never reaches the destructive step.
_resolve_addrs() {
    # Prints whitespace-separated IPv4 and IPv6 addresses for a host, or
    # returns non-zero on resolution failure. Tries getent, host, and
    # Python stdlib so it works on Linux + macOS without extra deps.
    local host="$1"
    local out=""
    if command -v getent >/dev/null 2>&1; then
        local v4 v6
        v4="$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u)"
        v6="$(getent ahostsv6 "$host" 2>/dev/null | awk '{print $1}' | sort -u)"
        # ponytail: command substitution strips trailing newlines, so the two
        # outputs must be joined with an explicit separator — a bare
        # `out="$out$v6"` merges the last v4 address and the first v6 address
        # onto one line, making the address comparison ambiguous. The
        # separator is only inserted when BOTH families resolved — joining
        # with a newline when both are empty yields a single non-empty
        # newline that would skip the host/python fallbacks for a host
        # getent cannot resolve.
        if [ -n "$v4" ] && [ -n "$v6" ]; then
            out="$v4
$v6"
        else
            out="$v4$v6"
        fi
    fi
    if [ -z "$out" ] && command -v python3 >/dev/null 2>&1; then
        # Python stdlib resolves /etc/hosts + DNS (covers macOS where `host`
        # only queries DNS and misses localhost). The host is passed via
        # argv, never interpolated into the script source — a host containing
        # a quote (or anything else) cannot break out of the -c string.
        out="$(python3 -c "
import socket, sys
try:
    infos = socket.getaddrinfo(sys.argv[1], None, proto=socket.IPPROTO_TCP)
except socket.gaierror:
    sys.exit(1)
seen = set()
for fam, _stype, _proto, _canon, sockaddr in infos:
    addr = sockaddr[0]
    if fam == socket.AF_INET6:
        addr = addr.split('%')[0]
    seen.add(addr)
print(' '.join(sorted(seen)))
" "$host" 2>/dev/null)" || true
    fi
    if [ -z "$out" ] && command -v host >/dev/null 2>&1; then
        out="$(host "$host" 2>/dev/null | awk '/has (IPv4|IPv6) address/ {print $NF}' | sort -u)"
    fi
    if [ -z "$out" ]; then
        return 1
    fi
    printf '%s' "$out"
}

_drill_addrs=$(_resolve_addrs "${DB_HOST}") || {
    echo "[restore-drill] REFUSING: could not resolve drill DB host '${DB_HOST}'." >&2
    echo "[restore-drill]        a drill must run against a DEDICATED SUPABASE_DB_DRILL_* throwaway DB." >&2
    exit 2
}
_prod_addrs=$(_resolve_addrs "${PROD_HOST}") || {
    echo "[restore-drill] REFUSING: could not resolve production DB host '${PROD_HOST}'." >&2
    echo "[restore-drill]        check SUPABASE_DB_HOST / SUPABASE_DB_PORT before running the drill." >&2
    exit 2
}

# Compare every resolved drill address paired with DB_PORT against every
# resolved production address paired with PROD_PORT. Any shared
# (address, port) pair is a production match.
_refuse=0
for _da in $_drill_addrs; do
    for _pa in $_prod_addrs; do
        if [ "$_da" = "$_pa" ] && [ "${DB_PORT}" = "${PROD_PORT}" ]; then
            _refuse=1
            break 2
        fi
    done
done
if [ "$_refuse" -eq 1 ]; then
    echo "[restore-drill] REFUSING: drill target resolves to the production endpoint (${PROD_HOST}:${PROD_PORT})." >&2
    echo "[restore-drill]        a drill must run against a DEDICATED SUPABASE_DB_DRILL_* throwaway DB." >&2
    exit 2
fi

echo "[restore-drill] ==========================================================="
echo "[restore-drill] RESTORE DRILL — THROWAWAY DATABASE ONLY"
echo "[restore-drill] ==========================================================="
echo "[restore-drill] backup file: ${BACKUP_FILE}"
echo "[restore-drill] target DB  : ${DB_HOST}:${DB_PORT}/${DB_NAME} (user=${DB_USER})"
echo "[restore-drill]"
echo "[restore-drill] DANGER CHECK: the target database MUST be a throwaway."
echo "[restore-drill]   - It must NOT be the production database."
echo "[restore-drill]   - The target must be disposable and pre-provisioned with managed Auth plus required extensions."
echo "[restore-drill]"
printf "[restore-drill] Type the target DB name to confirm it is throwaway: "
read -r CONFIRM_NAME
if [ "${CONFIRM_NAME}" != "${DB_NAME}" ]; then
    echo "[restore-drill] REFUSING: confirmation did not match DB name '${DB_NAME}'." >&2
    exit 2
fi
echo "[restore-drill] Confirmed target is '${DB_NAME}'. Proceeding."
echo "[restore-drill]"

if ! command -v pg_restore >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
    echo "[restore-drill] ERROR: pg_restore and psql must both be on PATH." >&2
    exit 2
fi

START_EPOCH=$(date +%s)
echo "[restore-drill] START $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

export PGPASSWORD="${SUPABASE_DB_DRILL_PASSWORD}"

# Public application tables depend on managed Supabase Auth and application
# extensions. Refuse a generic PostgreSQL target that cannot satisfy them.
AUTH_OK=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "SELECT CASE WHEN to_regclass('auth.users') IS NOT NULL AND to_regprocedure('auth.uid()') IS NOT NULL AND to_regprocedure('auth.role()') IS NOT NULL THEN 'auth-ok' ELSE 'auth-missing' END;" 2>/dev/null || true)
if [ "${AUTH_OK}" != "auth-ok" ]; then
    echo "[restore-drill] REFUSING: target lacks managed Auth tables/functions (auth.users, auth.uid, auth.role)." >&2
    unset PGPASSWORD
    exit 2
fi
for extension in pgcrypto pg_trgm uuid-ossp vector; do
    if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -Atc "SELECT 1 FROM pg_available_extensions WHERE name='${extension}' LIMIT 1;" | grep -qx 1; then
        echo "[restore-drill] REFUSING: target does not provide PostgreSQL extension '${extension}'." >&2
        unset PGPASSWORD
        exit 2
    fi
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS \"${extension}\";" >/dev/null
 done

RESTORE_LIST=$(mktemp "${TMPDIR:-/tmp}/tayari-restore-list.XXXXXX")
trap 'rm -f "${RESTORE_LIST}"' EXIT
pg_restore --list "${BACKUP_FILE}" | sed -E '/SCHEMA - public /d; /COMMENT - SCHEMA public/d' > "${RESTORE_LIST}"
# The target is explicitly disposable. Avoid --clean: pg_restore emits DROP
# POLICY ... ON table statements before recreating the table, which fails on a
# fresh target before the relation exists.
if ! pg_restore --use-list="${RESTORE_LIST}" --no-owner --no-acl \
        -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
        -d "${DB_NAME}" "${BACKUP_FILE}"; then
    echo "[restore-drill] ERROR: pg_restore failed." >&2
    unset PGPASSWORD
    exit 1
fi
echo "[restore-drill] pg_restore completed."

# Verification: count rows in the key tables. A query error returns "-1" and is
# treated as a failure (not a passing zero).
echo "[restore-drill] verifying key tables..."
KEY_TABLES=(profiles resumes saved_jobs submission_receipts application_approvals agent_questions agent_runs run_events run_controls delivery_ledger tenants cohorts memberships push_subscriptions agent_tasks agent_router_events stripe_webhook_events)
FAIL=0
for t in "${KEY_TABLES[@]}"; do
    ROWS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
        -t -A -c "SELECT COUNT(*) FROM public.${t};" 2>/dev/null || echo "-1")
    if [ "${ROWS}" = "-1" ]; then
        echo "[restore-drill]   FAIL  ${t}: query error (table missing or unreadable)"
        FAIL=1
    else
        echo "[restore-drill]   OK    ${t}: ${ROWS} rows"
    fi
done

unset PGPASSWORD

END_EPOCH=$(date +%s)
echo "[restore-drill] END   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[restore-drill] elapsed: $(( END_EPOCH - START_EPOCH ))s"

if [ "${FAIL}" -ne 0 ]; then
    echo "[restore-drill] RESULT: FAIL — one or more key tables did not restore cleanly." >&2
    exit 1
fi

echo "[restore-drill] RESULT: PASS — all key tables present and queryable."
exit 0