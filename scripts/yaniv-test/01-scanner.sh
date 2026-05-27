#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "SCANNER" "sqlmap User-Agent → tarpit" \
  gw_curl -A "sqlmap/1.7" -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/"
print_trace
