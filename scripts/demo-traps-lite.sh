#!/usr/bin/env bash
# Shortcut: local trap demo → scripts/yaniv-test/run-all.sh
# Usage:
#   ./scripts/demo-traps-lite.sh
#   HOST=192.168.0.89 ./scripts/demo-traps-lite.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export TARGET="${TARGET:-${HOST:-localhost}}"
exec "${DIR}/yaniv-test/run-all.sh"
