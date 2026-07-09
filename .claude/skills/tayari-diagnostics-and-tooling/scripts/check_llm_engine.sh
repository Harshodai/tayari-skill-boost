#!/usr/bin/env bash
# check_llm_engine.sh — Is the Python AI engine running a REAL LLM or a MOCK?
#
# Curls the Python FastAPI health endpoint and reads `model_status`:
#   "loaded"            -> a real provider is wired (active_engine() != "mock-fallback")  -> exit 0
#   "llm_not_configured"-> MockProvider is serving fake resume/JSON output                -> exit 1
#   (unreachable / other) -> could not determine                                          -> exit 2
#
# Exit 1 is intentional and CI-gateable: a green pipeline that scored a resume
# against the mock engine proved nothing. Gate merges/evals on `exit 0` here.
# (Verified against backend/python/app/routes/health.py + llm_service.py, 2026-07-08.)
#
# Usage:
#   ./check_llm_engine.sh                      # default host URL http://localhost:8002/health
#   ./check_llm_engine.sh http://host:8002/health
#   TAYARI_PY_HEALTH_URL=http://python-ai:8000/health ./check_llm_engine.sh   # inside compose network
set -euo pipefail

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
    echo "REAL LLM: model_status=loaded — a real provider is wired."
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
