#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "PATH_TRAVERSAL" "contact ?file=../../../etc/passwd" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/contact/?file=..%2F..%2F..%2Fetc%2Fpasswd"
step "PATH_TRAVERSAL" "direct files service" \
  gw_curl -o /dev/null -w "    HTTP %{http_code}\n" \
    "${BASE}/internal/services/files/?file=../../../etc/passwd"
print_trace
