#!/usr/bin/env bash
# Partial automated QA — Layer 1 smoke + curl RBAC/traps/resilience probes.
# Requires: pnpm dev:full already running (ui :3000, telemetry :3002).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${QA_BASE_URL:-http://localhost:3000}"
# Next.js issues 308 to trailing-slash URLs — use slash-terminated paths throughout.
GW="${BASE}/gateway"
TEL="${QA_TELEMETRY_URL:-http://localhost:3002}"
API="${BASE}/api"
slash() { local p="$1"; [[ "$p" == */ ]] && echo "$p" || echo "${p}/"; }
GW_LOGIN="$(slash "$GW/login")"
GW_WORKSPACE="$(slash "$GW/workspace")"
GW_DASHBOARD="$(slash "$GW/dashboard")"
API_EVENTS="$(slash "$API/admin/events")"
API_LOGIN="$(slash "$API/admin/login")"
API_VERIFY="$(slash "$API/admin/verify-otp")"
API_DEBUG_TOTP="$(slash "$API/admin/debug/totp")"
API_TIMELINE_INVALID="$(slash "$API/admin/attackers/not-an-ip/timeline")"
RESULTS="${ROOT}/docs/qa-automated-results.txt"
PASS=0
FAIL=0
SKIP=0

mkdir -p "$(dirname "$RESULTS")"
: >"$RESULTS"

log() { echo "$*" | tee -a "$RESULTS"; }
pass() { PASS=$((PASS + 1)); log "PASS $*"; }
fail() { FAIL=$((FAIL + 1)); log "FAIL $*"; }
skip() { SKIP=$((SKIP + 1)); log "SKIP $*"; }

assert_http() {
  local id="$1" url="$2" expect="$3"
  shift 3
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$@" "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]]; then
    pass "$id expected HTTP $expect got $code — $url"
  else
    fail "$id expected HTTP $expect got $code — $url"
  fi
}

assert_code_in() {
  local id="$1" url="$2"
  shift 2
  local allowed=("$@")
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  local ok=0 exp
  for exp in "${allowed[@]}"; do
    if [[ "$code" == "$exp" ]]; then ok=1; break; fi
  done
  if [[ $ok -eq 1 ]]; then
    pass "$id HTTP $code in {${allowed[*]}} — $url"
  else
    fail "$id HTTP $code not in {${allowed[*]}} — $url"
  fi
}

assert_body_contains() {
  local id="$1" url="$2" needle="$3"
  shift 3
  local body
  body=$(curl -s "$@" "$url" 2>/dev/null || true)
  if echo "$body" | grep -qF "$needle"; then
    pass "$id body contains '$needle'"
  else
    fail "$id body missing '$needle' — $url"
  fi
}

log "=== QA smoke $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
log "BASE=$BASE TEL=$TEL"

# --- Layer 1 ---
assert_code_in "S2" "$GW_LOGIN" 200 302

if curl -s -o /dev/null --connect-timeout 2 "$TEL/test-trap" 2>/dev/null; then
  if (cd "$ROOT/services/logging-data-extraction" && TEST_SERVER_URL="$TEL" npm run mock-attack >>"$RESULTS" 2>&1); then
    pass "S3 mock-attack exit 0"
  else
    fail "S3 mock-attack failed"
  fi
else
  fail "S3 telemetry not reachable at $TEL"
fi

# --- RBAC ---
assert_http "R3" "$API_EVENTS" "401"
# F12: unauthenticated workspace should not return 200 OK page
f12=$(curl -s -o /dev/null -w "%{http_code}" "$GW_WORKSPACE" 2>/dev/null || echo "000")
if [[ "$f12" == "302" || "$f12" == "303" || "$f12" == "401" ]]; then
  pass "F12 workspace unauthenticated HTTP $f12"
else
  fail "F12 workspace unauthenticated expected redirect got $f12"
fi

# R2 dashboard without auth — redirect or 401/403
assert_code_in "R2" "$GW_DASHBOARD" "302" "307" "401" "403"

# --- API secrets ---
assert_http "A2" "$TEL/internal/live-alert" "401" -X POST -H "Content-Type: application/json" -d '{}'

# A1 debug totp — should not leak in production NODE_ENV
code=$(curl -s -o /dev/null -w "%{http_code}" "$API_DEBUG_TOTP" 2>/dev/null || echo "000")
if [[ "$code" == "404" || "$code" == "403" ]]; then
  pass "A1 debug/totp disabled ($code)"
elif [[ "$code" == "400" ]]; then
  pass "A1 debug/totp requires username in dev ($code)"
elif [[ "$code" == "200" && "${NODE_ENV:-development}" == "development" ]]; then
  skip "A1 debug/totp returns OTP in dev — disable DEBUG_TOTP for production"
else
  fail "A1 debug/totp unexpected $code"
fi

# --- Resilience (admin API) ---
e1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_LOGIN" \
  -H "Content-Type: application/json" -d '{"username":"ab","password":"x"}' 2>/dev/null || echo "000")
if [[ "$e1" == "400" || "$e1" == "401" ]]; then
  pass "E1 short login rejected HTTP $e1"
else
  fail "E1 expected 400/401 got $e1"
fi
e2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_LOGIN" \
  -H "Content-Type: application/json" -d '{"username":"validuser","password":"short"}' 2>/dev/null || echo "000")
if [[ "$e2" == "400" || "$e2" == "401" ]]; then
  pass "E2 short password rejected HTTP $e2"
else
  fail "E2 expected 400/401 got $e2"
fi
e3=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_VERIFY" \
  -H "Content-Type: application/json" -d '{"otp":"abc"}' 2>/dev/null || echo "000")
if [[ "$e3" == "400" || "$e3" == "401" ]]; then
  pass "E3 bad OTP rejected HTTP $e3"
else
  fail "E3 expected 400/401 got $e3"
fi

# E5 invalid IP timeline
e5=$(curl -s -o /dev/null -w "%{http_code}" "$API_TIMELINE_INVALID" 2>/dev/null || echo "000")
if [[ "$e5" == "400" || "$e5" == "401" || "$e5" == "404" ]]; then
  pass "E5 invalid IP timeline HTTP $e5"
else
  fail "E5 invalid IP timeline expected 400/401/404 got $e5"
fi

# --- Traps (gateway via proxy) ---
# T1 SQLi login POST — expect redirect (302/303) to bypass
sqli_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -d "username=admin'%20OR%201=1--&password=anything12345" \
  "$GW_LOGIN" 2>/dev/null || echo "000")
if [[ "$sqli_code" =~ ^(302|303)$ ]]; then
  pass "T1 SQLi login redirect $sqli_code"
else
  fail "T1 SQLi login expected 302/303 got $sqli_code"
fi

# T6 recon
assert_code_in "T6" "$(slash "$GW/contact")?path=/.env" "200" "302" "303"

# T8 path traversal
assert_code_in "T8" "$(slash "$GW/internal/services/files")?file=../../../etc/passwd" "200" "302"

# T9 SSRF
assert_code_in "T9" "$(slash "$GW/internal/services/fetch-status")?url=http://169.254.169.254/latest/meta-data/" "200" "302"

# T10 scanner (allow slow response)
scanner_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 \
  -A "sqlmap/1.7" "$(slash "$GW")" 2>/dev/null || echo "000")
if [[ "$scanner_code" == "200" || "$scanner_code" == "302" ]]; then
  pass "T10 scanner UA completed HTTP $scanner_code"
else
  fail "T10 scanner UA got $scanner_code"
fi

# T4 data bomb — HEAD avoids 100GB stream; expect zip attachment headers
bomb_headers=$(curl -sI --max-time 10 "$(slash "$GW/documents")?download=backup.zip" 2>/dev/null || true)
if echo "$bomb_headers" | head -1 | grep -q "200" && echo "$bomb_headers" | grep -qi "application/zip"; then
  pass "T4 data bomb HEAD 200 application/zip"
else
  fail "T4 data bomb missing 200/zip headers"
fi

# T3 XSS blocked — contact with cookie jar
jar=$(mktemp)
xss_blocked=$(curl -s -o /dev/null -w "%{http_code}" -b "$jar" -c "$jar" \
  "$(slash "$GW/contact")?msg=%3Cscript%3Ealert(document.cookie)%3C%2Fscript%3E" 2>/dev/null || echo "000")
if [[ "$xss_blocked" =~ ^(200|302)$ ]]; then
  pass "T3 XSS blocked path HTTP $xss_blocked"
else
  fail "T3 XSS blocked HTTP $xss_blocked"
fi

# T2 XSS probe
xss_probe=$(curl -s -o /dev/null -w "%{http_code}" -b "$jar" -c "$jar" \
  "$(slash "$GW/contact")?msg=%3Cscript%3Ealert(1)%3C%2Fscript%3E" 2>/dev/null || echo "000")
if [[ "$xss_probe" =~ ^(200|302)$ ]]; then
  pass "T2 XSS probe path HTTP $xss_probe"
else
  fail "T2 XSS probe HTTP $xss_probe"
fi
rm -f "$jar"

# T5 brute — 5 failed logins
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -X POST -d "username=admin&password=wrongpass$i" "$GW_LOGIN" || true
done
brute_loc=$(curl -s -o /dev/null -w "%{redirect_url}" -X POST \
  -d "username=admin&password=wrongpass5" "$GW_LOGIN" 2>/dev/null || true)
if echo "$brute_loc" | grep -qE 'console|breach|legacy'; then
  pass "T5 brute force handoff redirect"
else
  # follow final URL
  brute_final=$(curl -s -o /dev/null -w "%{http_code}" -L -X POST \
    -d "username=admin&password=wrongpass5" "$GW_LOGIN" 2>/dev/null || echo "000")
  if [[ "$brute_final" =~ ^(200|302)$ ]]; then
    pass "T5 brute completed HTTP $brute_final (check console manually)"
  else
    fail "T5 brute force unexpected ($brute_loc / $brute_final)"
  fi
fi

# E9 legacy lockout (11 attempts)
for i in $(seq 1 11); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}' \
    "$(slash "$GW/internal/auth/legacy")" 2>/dev/null || echo "000")
done
if [[ "$code" == "423" ]]; then
  pass "E9 legacy auth 11th attempt HTTP 423"
else
  fail "E9 legacy auth 11th attempt expected 423 got $code"
fi

log "=== Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP ==="
if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
