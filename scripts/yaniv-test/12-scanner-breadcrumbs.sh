#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init
step "SCANNER" "robots.txt" \
  gw_curl -A "nikto/2.1.6" -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/robots.txt"
step "SCANNER" "sitemap.xml" \
  gw_curl -A "nmap/7.94" -o /dev/null -w "    HTTP %{http_code}\n" "${BASE}/sitemap.xml"
step "SCANNER" "nmap UA on home" \
  gw_curl -A "Nmap Scripting Engine" -o /dev/null -w "    HTTP %{http_code}\n" --max-time 30 "${BASE}/"
print_trace
