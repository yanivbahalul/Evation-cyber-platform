#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
echo "[BRUTE_FORCE] 5× failed employee login → breach illusion"
for i in 1 2 3 4 5; do
  gw_curl -o /dev/null -w "    attempt $i → HTTP %{http_code} %{url_effective}\n" \
    -X POST -d "username=admin&password=wrong$i" "${BASE}/login/"
done
echo ""
print_trace
