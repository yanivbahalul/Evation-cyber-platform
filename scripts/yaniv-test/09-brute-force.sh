#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
echo "[BRUTE_FORCE] 5× failed employee login → breach illusion"
echo "    (note: trigger threshold is randomized between 5–10)"
for i in 1 2 3 4 5 6 7 8 9 10; do
  effective_url="$(
    gw_curl -o /dev/null -w "%{url_effective}" \
      -X POST -d "username=admin&password=wrong$i" "${BASE}/login/"
  )"
  echo "    attempt $i → ${effective_url}"
  if [[ "${effective_url}" == *"/internal/auth/legacy"* || "${effective_url}" == *"/decoy-portal/login"* ]]; then
    echo "    handoff observed on attempt $i"
    break
  fi
done
echo ""
print_trace
