#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "XSS_PROBE" "contact msg <script>alert(1)</script>" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/contact/?msg=%3Cscript%3Ealert(1)%3C%2Fscript%3E"
step "XSS_PROBE" "img onerror probe" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/contact/?msg=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E"
print_trace
