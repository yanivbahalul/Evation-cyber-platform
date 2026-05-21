#!/usr/bin/env bash
# Run all automated QA scripts (stack must be up on :3000 and :3002).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS="$ROOT/docs/qa-automated-results.txt"
: >"$RESULTS"
echo "=== QA run-all $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" | tee "$RESULTS"

failures=0
run() {
  echo "" | tee -a "$RESULTS"
  echo "--- $1 ---" | tee -a "$RESULTS"
  if bash "$ROOT/scripts/$2" >>"$RESULTS" 2>&1; then
    echo "OK $1" | tee -a "$RESULTS"
  else
    echo "FAILED $1 (exit $?)" | tee -a "$RESULTS"
    failures=$((failures + 1))
  fi
}

run "qa-smoke" "qa-smoke.sh"
run "qa-auth-matrix" "qa-auth-matrix.sh"
run "qa-resilience-extra" "qa-resilience-extra.sh"
echo "" | tee -a "$RESULTS"
echo "--- qa-verify-events ---" | tee -a "$RESULTS"
if (cd "$ROOT/services/logging-data-extraction" && node scripts/verifyQaEvents.js >>"$RESULTS" 2>&1); then
  echo "OK qa-verify-events" | tee -a "$RESULTS"
else
  echo "FAILED qa-verify-events" | tee -a "$RESULTS"
  failures=$((failures + 1))
fi

echo "" | tee -a "$RESULTS"
echo "=== run-all done failures=$failures ===" | tee -a "$RESULTS"
exit "$failures"
