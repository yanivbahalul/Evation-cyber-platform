#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "SSRF" "contact url → metadata IP" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/contact/?url=http://169.254.169.254/latest/meta-data/"
step "SSRF" "fetch-status service (JSON)" \
  gw_curl -H "Accept: application/json" -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/internal/services/fetch-status/?url=http://169.254.169.254/latest/meta-data/"
print_trace
