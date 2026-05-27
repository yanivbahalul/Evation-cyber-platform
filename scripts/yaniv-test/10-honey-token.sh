#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
echo "[HONEY_TOKEN] fetch apiKey from keys page"
KEY=$(gw_curl "${BASE}/internal/integrations/keys/" | grep -oE 'itc_[A-Za-z0-9]{20,}' | head -1 || true)
if [[ -z "$KEY" ]]; then
  echo "    ⚠ could not extract apiKey — open ${BASE}/internal/integrations/keys/ in browser"
  exit 1
fi
echo "    key: ${KEY:0:12}…"
gw_curl -o /dev/null -w "    Bearer trigger → HTTP %{http_code}\n" \
  -H "Authorization: Bearer ${KEY}" "${BASE}/"
echo ""
print_trace
