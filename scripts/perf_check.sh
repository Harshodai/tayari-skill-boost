#!/usr/bin/env bash
set -e
START=$(date +%s)
# Minimal autopilot run placeholder – replace with actual command if available
# Example: curl -s -X POST http://localhost:8085/api/v1/autopilot/run -d '{"config":"minimal"}'
# Simulate short work
echo "Starting autopilot run (simulated)"
sleep 1
END=$(date +%s)
ELAPSED=$((END-START))
echo "Autopilot run took ${ELAPSED}s"
if [ "$ELAPSED" -gt 30 ]; then
  echo "Performance check failed: exceeds 30 seconds"
  exit 1
fi
# Write duration for CI annotation
echo "$ELAPSED" > perf_time.txt
