#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "RECON" "scanner-style path /.env" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/contact/?path=/.env"
step "RECON" "wp-admin hint in query" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/?q=wp-admin"
print_trace
