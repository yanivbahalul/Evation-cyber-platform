#!/usr/bin/env bash
# Fire one hit per trap type (remote-friendly demo-traps-lite).
# Usage: TARGET=192.168.0.89 ./run-all.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/lib/common.sh"
trap _common_cleanup EXIT
require_target
_common_init

echo "Running all trap scripts (pause ${PAUSE}s between steps)…"
echo ""

"${DIR}/01-scanner.sh"
"${DIR}/02-recon.sh"
"${DIR}/03-sqli-login.sh"
"${DIR}/04-xss-probe.sh"
"${DIR}/05-xss-blocked.sh"
"${DIR}/06-path-traversal.sh"
"${DIR}/07-ssrf.sh"
"${DIR}/08-data-bomb.sh"
"${DIR}/09-brute-force.sh"
"${DIR}/10-honey-token.sh"

KEEP_COOKIE=1
export KEEP_COOKIE
print_trace
