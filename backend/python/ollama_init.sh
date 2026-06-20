#!/bin/bash
# Ollama model initialization script for Tayari
# Run this after the Ollama container is healthy to pull the Hermes 3 8B model

set -e

OLLAMA_URL="${OLLAMA_HOST:-http://ollama:11434}"
MODEL="${OLLAMA_MODEL:-hermes3:8b}"

echo "Waiting for Ollama to be ready at $OLLAMA_URL..."
until curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; do
  echo "Ollama not ready yet... sleeping 2s"
  sleep 2
done

echo "Ollama is ready. Pulling model: $MODEL"
curl -X POST "$OLLAMA_URL/api/pull" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$MODEL\"}"

echo ""
echo "Model $MODEL is ready. Tayari can now use local LLM inference!"
echo "Set LLM_BASE_URL=$OLLAMA_URL and LLM_MODEL=$MODEL in your .env"
