#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "DATA_BOMB" "documents?download=backup.zip" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" --max-time 10 \
    "${BASE}/documents/?download=backup.zip"
step "DATA_BOMB" "internal archive export" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" --max-time 10 \
    "${BASE}/internal/exports/archive/"
print_trace
