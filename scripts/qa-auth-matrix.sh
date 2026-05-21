#!/usr/bin/env bash
# RBAC + auth functional probes (requires DEBUG_TOTP=true and known QA_TEST_PASSWORD in env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/adminpannel/.env.local"
BASE="${QA_BASE_URL:-http://localhost:3000}"
API="${BASE}/api"
GW="${BASE}/gateway"
RESULTS="${ROOT}/docs/qa-automated-results.txt"
PASS=0
FAIL=0
SKIP=0

log() { echo "$*" | tee -a "$RESULTS"; }
pass() { PASS=$((PASS + 1)); log "PASS $*"; }
fail() { FAIL=$((FAIL + 1)); log "FAIL $*"; }
skip() { SKIP=$((SKIP + 1)); log "SKIP $*"; }

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

ADMIN_USER="${QA_TEST_ADMIN_USER:-admin}"
ADMIN_PASS="${QA_TEST_ADMIN_PASSWORD:-}"
USER_NAME="${QA_TEST_USER:-}"
USER_PASS="${QA_TEST_USER_PASSWORD:-}"

log "=== QA auth matrix $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ "${DEBUG_TOTP:-}" != "true" ]]; then
  skip "Auth matrix: DEBUG_TOTP not true — set in .env.local for automated F/R tests"
  log "=== Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP ==="
  exit 0
fi

if [[ -z "$ADMIN_PASS" ]]; then
  skip "Auth matrix: set QA_TEST_ADMIN_PASSWORD for admin login tests"
  log "=== Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP ==="
  exit 0
fi

jar_admin=$(mktemp)
jar_user=$(mktemp)
trap 'rm -f "$jar_admin" "$jar_user"' EXIT

fetch_otp() {
  local user="$1"
  local otp
  otp=$(curl -s "${GW}/debug/totp/?username=${user}" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).code||'')}catch{}})" 2>/dev/null || true)
  if [[ -n "$otp" ]]; then
    echo "$otp"
    return 0
  fi
  otp=$(curl -s "${API}/admin/debug/totp/?username=${user}" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).code||'')}catch{}})" 2>/dev/null || true)
  [[ -n "$otp" ]] && echo "$otp"
}

login_and_otp() {
  local jar="$1" user="$2" pass="$3"
  local login_body
  login_body=$(curl -s -c "$jar" -b "$jar" -X POST "$API/admin/login/" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}")
  echo "$login_body" | grep -q '"success":true' || return 1
  local otp
  otp=$(fetch_otp "$user")
  if [[ -z "$otp" ]]; then
    return 1
  fi
  local verify_body
  verify_body=$(curl -s -c "$jar" -b "$jar" -X POST "$API/admin/verify-otp/" \
    -H "Content-Type: application/json" \
    -d "{\"otp\":\"$otp\"}")
  echo "$verify_body" | grep -q '"success":true'
}

if login_and_otp "$jar_admin" "$ADMIN_USER" "$ADMIN_PASS"; then
  pass "F1/F3 admin login + OTP"
  code=$(curl -s -o /dev/null -w "%{http_code}" -b "$jar_admin" "$API/admin/events/")
  if [[ "$code" == "200" ]]; then
    pass "F15 GET /api/admin/events 200"
  else
    fail "F15 admin events expected 200 got $code"
  fi
  stats=$(curl -s -o /dev/null -w "%{http_code}" -b "$jar_admin" "$API/admin/stats/")
  if [[ "$stats" == "200" ]]; then pass "F15 stats 200"; else fail "F15 stats got $stats"; fi
  if grep -q admin_auth "$jar_admin" 2>/dev/null; then
    pass "F3 admin_auth cookie present"
  else
    # safezone admin may only get auth cookie
    if grep -qE '\bauth\b' "$jar_admin" 2>/dev/null; then
      pass "F3 auth cookie present (admin via safezone users)"
    else
      fail "F3 no session cookies"
    fi
  fi
  for path in workspace profile documents; do
    c=$(curl -s -o /dev/null -w "%{http_code}" -b "$jar_admin" "${GW}/${path}/")
    if [[ "$c" == "200" ]]; then pass "F8-10 ${path} HTTP 200"; else fail "F8-10 ${path} got $c"; fi
  done
  wrong=$(curl -s -c "$jar_admin" -b "$jar_admin" -X POST "$API/admin/verify-otp/" \
    -H "Content-Type: application/json" -d '{"otp":"000000"}' | grep -c '"success":false' || true)
  if [[ "$wrong" -ge 1 ]]; then pass "F2 wrong OTP rejected"; else fail "F2 wrong OTP not rejected"; fi
else
  fail "F3 admin login flow"
fi

if [[ -n "$USER_NAME" && -n "$USER_PASS" ]]; then
  if login_and_otp "$jar_user" "$USER_NAME" "$USER_PASS"; then
    pass "F4 user login + OTP"
    code=$(curl -s -o /dev/null -w "%{http_code}" -b "$jar_user" "$API/admin/events/")
    if [[ "$code" == "401" || "$code" == "403" ]]; then
      pass "R4 user blocked from admin events ($code)"
    else
      fail "R4 user events expected 401/403 got $code"
    fi
    if grep -q admin_auth "$jar_user" 2>/dev/null; then
      fail "F4 user must not have admin_auth cookie"
    else
      pass "F4 no admin_auth for user"
    fi
    portal=$(curl -s -b "$jar_user" "${API}/portal/session/")
    if echo "$portal" | grep -q '"role":"user"' && echo "$portal" | grep -qE 'attackMonitorUrl":null'; then
      pass "R1 user has no attack monitor URL in portal session"
    else
      fail "R1 user portal session should be role=user without attackMonitorUrl"
    fi
  else
    fail "F4 user login flow"
  fi
else
  skip "R1/R4/F4: set QA_TEST_USER and QA_TEST_USER_PASSWORD for employee RBAC"
fi

# R7 forged JWT
code=$(curl -s -o /dev/null -w "%{http_code}" -b "admin_auth=not.a.jwt" "$API/admin/events/")
if [[ "$code" == "401" ]]; then
  pass "R7 forged admin_auth → 401"
else
  fail "R7 forged token expected 401 got $code"
fi

log "=== Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP ==="
[[ $FAIL -eq 0 ]]
