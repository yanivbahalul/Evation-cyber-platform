#!/usr/bin/env bash
# Extra resilience probes: E4 traceId query, E13 rate limit, T7 honey token page.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/adminpannel/.env.local"
BASE="${QA_BASE_URL:-http://localhost:3000}"
GW="${BASE}/gateway"
TEL="${QA_TELEMETRY_URL:-http://localhost:3002}"
API="${BASE}/api"
RESULTS="${ROOT}/docs/qa-automated-results.txt"
PASS=0
FAIL=0

log() { echo "$*" | tee -a "$RESULTS"; }
pass() { PASS=$((PASS + 1)); log "PASS $*"; }
fail() { FAIL=$((FAIL + 1)); log "FAIL $*"; }

if [[ -f "$ENV_FILE" ]]; then set -a; source "$ENV_FILE"; set +a; fi

log "=== QA resilience-extra $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# E4 huge traceId — should not 500
e4=$(curl -s -o /dev/null -w "%{http_code}" "${API}/admin/events/?traceId=$(python3 -c 'print("a"*8000)' 2>/dev/null || printf 'a%.0s' {1..800})" 2>/dev/null || echo "000")
if [[ "$e4" == "401" || "$e4" == "400" || "$e4" == "200" ]]; then
  pass "E4 huge traceId HTTP $e4 (no 500)"
else
  fail "E4 huge traceId HTTP $e4"
fi

# T7 honey keys page loads
t7=$(curl -s -o /dev/null -w "%{http_code}" "${GW}/internal/integrations/keys/" 2>/dev/null || echo "000")
if [[ "$t7" == "200" ]]; then
  pass "T7 honey token keys page HTTP 200"
else
  fail "T7 honey keys page HTTP $t7"
fi

# E13 log flood — logLimiter sets isLogFlooding after 30 hits/5s (no HTTP 429; server must stay up)
token="${ADMIN_SOCKET_TOKEN:-}"
if [[ -z "$token" ]]; then
  log "SKIP E13 no ADMIN_SOCKET_TOKEN"
else
  ok=0
  for i in $(seq 1 35); do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${TEL}/internal/live-alert" \
      -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" \
      -d "{\"trapType\":\"SCANNER\",\"attackerIp\":\"10.99.0.1\",\"payload\":\"flood-$i\"}" 2>/dev/null || echo "000")
    [[ "$code" == "200" ]] && ok=1
  done
  if [[ $ok -eq 1 ]]; then
    pass "E13 live-alert burst 35x — server responded (logLimiter soft-floods, see TELEMETRY logs)"
  else
    fail "E13 live-alert burst — no 200 responses"
  fi
fi

log "=== Summary: PASS=$PASS FAIL=$FAIL ==="
[[ $FAIL -eq 0 ]]
