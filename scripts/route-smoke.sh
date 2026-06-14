#!/usr/bin/env bash
# Quick HTTP smoke test for nginx-exposed routes (port 3000).
# Usage: ./scripts/route-smoke.sh [base_url]
set -euo pipefail

BASE="${1:-http://localhost:3000}"
FAIL=0
PASS=0

check_redirect() {
  local name="$1" url="$2" expect="$3"
  local code
  code=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  local ok=0
  IFS='|' read -ra codes <<< "$expect"
  for c in "${codes[@]}"; do [[ "$code" = "$c" ]] && ok=1 && break; done
  if [[ $ok -eq 1 ]]; then echo "PASS [$code] $name"; PASS=$((PASS + 1))
  else echo "FAIL [$code] $name (expected $expect)"; FAIL=$((FAIL + 1)); fi
}

check() {
  local name="$1" url="$2" expect="$3" method="${4:-GET}"
  local code body
  if [[ "$method" = "POST" ]]; then
    code=$(curl -s --max-time 10 -o /tmp/route_smoke_body -w "%{http_code}" -X POST -L "$url" 2>/dev/null || echo "000")
  else
    code=$(curl -s --max-time 10 -o /tmp/route_smoke_body -w "%{http_code}" -L "$url" 2>/dev/null || echo "000")
  fi
  body=$(head -c 160 /tmp/route_smoke_body 2>/dev/null | tr '\n' ' ')
  local ok=0
  IFS='|' read -ra codes <<< "$expect"
  for c in "${codes[@]}"; do
    if [[ "$code" = "$c" ]]; then ok=1; break; fi
  done
  if echo "$body" | grep -qi "Cannot GET\|Cannot POST"; then ok=0; fi
  if [[ $ok -eq 1 ]]; then
    echo "PASS [$code] $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL [$code] $name (expected $expect)"
    echo "       $body"
    FAIL=$((FAIL + 1))
  fi
}

echo "Route smoke test @ $BASE"
echo ""

check "root" "$BASE/" "200|302"
check "gateway home" "$BASE/gateway/" "200"
check "login" "$BASE/gateway/login" "200"
check "register" "$BASE/gateway/register" "200"
check "logout GET" "$BASE/gateway/logout" "200|302"
check "dashboard" "$BASE/gateway/dashboard/" "200|302|307"
check "ops legacy" "$BASE/ops/" "200|302|307"
check_redirect "admin/ban redirect" "$BASE/admin/ban" "307|302"
check "internal/console" "$BASE/gateway/internal/console" "200"
check "api session" "$BASE/api/portal/session" "200"
check "api dashboard (no auth)" "$BASE/api/admin/dashboard" "401"
check "api logout POST" "$BASE/api/admin/logout" "200" POST
check "legacy signout GET" "$BASE/gateway/internal/auth/signout" "200|302"
check "socket.io" "$BASE/socket.io/?EIO=4&transport=polling" "200|400"

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "All $PASS checks passed."
  exit 0
else
  echo "$PASS passed, $FAIL failed."
  exit 1
fi
