#!/usr/bin/env bash
# Lite trap demo — one hit per trap type for the admin dashboard (live Socket.IO).
# Usage:
#   ./scripts/demo-traps-lite.sh
#   HOST=192.168.0.89 ./scripts/demo-traps-lite.sh
#
# Prereq: pnpm dev:full (UI :3000, gateway proxied under /gateway/)

set -euo pipefail

HOST="${HOST:-localhost}"
PORT="${PORT:-3000}"
BASE="http://${HOST}:${PORT}/gateway"
COOKIE="${TMPDIR:-/tmp}/evation-traps-$$.txt"
PAUSE="${PAUSE:-1.5}"

cleanup() { rm -f "$COOKIE"; }
trap cleanup EXIT

rm -f "$COOKIE"
echo "→ Target: ${BASE}/"
echo "→ Pause between traps: ${PAUSE}s"
echo ""

step() {
  echo "[$1] $2"
  shift 2
  "$@"
  echo ""
  sleep "$PAUSE"
}

step "1/9 SCANNER" \
  curl -sL -c "$COOKIE" -b "$COOKIE" -A "sqlmap/1.7" -o /dev/null -w "    HTTP %{http_code}\n" --max-time 20 "${BASE}/"

step "2/9 RECON" \
  curl -sL -c "$COOKIE" -b "$COOKIE" -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/contact/?path=/.env"

step "3/9 SQLI" \
  curl -sL -c "$COOKIE" -b "$COOKIE" -o /dev/null -w "    HTTP %{http_code} → %{url_effective}\n" \
    -X POST -d "username=admin'%20OR%201=1--&password=anything123" "${BASE}/login/"

step "4/9 XSS" \
  curl -sL -c "$COOKIE" -b "$COOKIE" -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/contact/?msg=%3Cscript%3Ealert(1)%3C%2Fscript%3E"

step "5/9 PATH_TRAVERSAL" \
  curl -sL -c "$COOKIE" -b "$COOKIE" -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/internal/services/files/?file=../../../etc/passwd"

step "6/9 SSRF" \
  curl -sL -c "$COOKIE" -b "$COOKIE" -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/internal/services/fetch-status/?url=http://169.254.169.254/latest/meta-data/"

step "7/9 DATA_BOMB" \
  curl -sL -c "$COOKIE" -b "$COOKIE" -o /dev/null -w "    HTTP %{http_code}\n" --max-time 6 \
    "${BASE}/documents/?download=backup.zip"

echo "[8/9] BRUTE_FORCE (5× wrong login)"
for i in 1 2 3 4 5; do
  curl -sL -c "$COOKIE" -b "$COOKIE" -o /dev/null -w "    attempt $i → HTTP %{http_code}\n" \
    -X POST -d "username=admin&password=wrong$i" "${BASE}/login/"
done
echo ""
sleep "$PAUSE"

echo "[9/9] HONEY_TOKEN"
KEY=$(curl -sL -c "$COOKIE" -b "$COOKIE" "${BASE}/internal/integrations/keys/" | grep -oE 'itc_[A-Za-z0-9]{20,}' | head -1)
if [[ -z "$KEY" ]]; then
  echo "    ⚠ could not read apiKey from keys page"
else
  curl -sL -c "$COOKIE" -b "$COOKIE" -o /dev/null -w "    trigger → HTTP %{http_code}\n" \
    -H "Authorization: Bearer ${KEY}" "${BASE}/"
fi
echo ""

TRACE=$(grep -E 'attacker_trace_id' "$COOKIE" 2>/dev/null | awk '{print $NF}' | tail -1 || true)
echo "Done."
[[ -n "$TRACE" ]] && echo "traceId: ${TRACE}"
echo "Dashboard: http://${HOST}:${PORT}/gateway/dashboard/  (Demo Mode OFF)"
