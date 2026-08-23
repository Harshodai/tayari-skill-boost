#!/usr/bin/env bash
# check_llm_engine.sh — Is the Python AI engine running a REAL LLM or a MOCK?
#
# Guards the "mock ≠ passing" rule: ensures evals and API endpoints
# fail when the LLM is mock/configured-unavailable.
#
# Exit 0 → real LLM configured and serving real results
# Exit 1 → MockProvider active (no real LLM) → CI must block
# Exit 2 → cannot determine (service unreachable)
#
# Usage:
#   ./check_llm_engine.sh                      # default host URL http://localhost:8002/health
#   ./check_llm_engine.sh http://host:8002/health
#   TAYARI_PY_HEALTH_URL=http://python-ai:8000/health ./check_llm_engine.sh   # inside compose network
set -euo pipefail

# ---- Check 1: LLM_API_KEY presence -----------------------------------------
if [ -z "${LLM_API_KEY:-}" ]; then
  echo "UNCONFIGURED: LLM_API_KEY is not set."
  echo "  Set LLM_API_KEY (or OPENROUTER_API_KEY / NVIDIA_NIM_API_KEY) to use a real provider."
  echo "  Without a key, the engine falls back to MockProvider which returns fake data."
  exit 1
fi

# ---- Check 2: Health endpoint model_status ---------------------------------
URL="${1:-${TAYARI_PY_HEALTH_URL:-http://localhost:8002/health}}"

# --http1.1 avoids rare curl/HTTP2 hangs; -sS = quiet but show errors; -m = hard timeout.
if ! body="$(curl -sS -m 8 --http1.1 "$URL" 2>/dev/null)"; then
  echo "UNREACHABLE: could not GET $URL"
  echo "  The Python engine is not up, or the URL/port is wrong."
  echo "  Host port is 8002 (container-internal 8000). Start the stack with:"
  echo "    docker compose --profile dev up -d --build"
  exit 2
fi

# Portable JSON scrape (no jq dependency): pull the model_status string value.
model_status="$(printf '%s' "$body" \
  | grep -o '"model_status"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 \
  | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')"

if [ -z "$model_status" ]; then
  echo "UNPARSEABLE: $URL responded but had no model_status field."
  echo "  Raw body: $body"
  exit 2
fi

case "$model_status" in
  loaded)
    echo "REAL LLM: model_status=loaded — a real provider is wired and LLM_API_KEY is present."
    echo "  Results from optimize/interview/cover-letter endpoints reflect a real model."
    echo "  (For the exact provider label, see server logs for active_engine() or"
    echo "   check LLM_PROVIDER/LLM_BASE_URL/OPENROUTER_API_KEY/NVIDIA_NIM_API_KEY/HERMES_AGENT_URL.)"
    exit 0
    ;;
  llm_not_configured)
    echo "MOCK LLM: model_status=llm_not_configured — MockProvider is active (engine label 'mock-fallback')."
    echo "  Every LLM endpoint returns PLAUSIBLE FAKE text. AI results here prove nothing."
    echo "  Configure a provider (LLM_BASE_URL / OPENROUTER_API_KEY / NVIDIA_NIM_API_KEY / HERMES_AGENT_URL)."
    exit 1
    ;;
  *)
    echo "UNKNOWN: model_status=$model_status (expected 'loaded' or 'llm_not_configured')."
    echo "  Raw body: $body"
    exit 2
    ;;
esac
