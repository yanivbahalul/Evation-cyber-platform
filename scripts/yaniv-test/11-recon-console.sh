#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "RECON" "fake admin console" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/internal/console/"
step "RECON" "breach=legacy deep link" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/internal/console/?breach=legacy"
print_trace
