#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
echo "[SQLI] Run after 03-sqli-login (or any SQLi trigger) — fake credential dump / tarpit"
gw_curl -o /dev/null -w "    query 1 → HTTP %{http_code}\n" \
  -X POST -d "query=SELECT+*+FROM+users" "${BASE}/internal/services/database/"
sleep "$PAUSE"
gw_curl -o /dev/null -w "    query 2 → HTTP %{http_code}\n" \
  -X POST -d "query=SELECT+username,password+FROM+users+WHERE+role='admin'" "${BASE}/internal/services/database/"
echo ""
gw_curl -o /dev/null -w "    export → HTTP %{http_code}\n" \
  "${BASE}/internal/services/database/?export=credentials"
echo ""
print_trace
