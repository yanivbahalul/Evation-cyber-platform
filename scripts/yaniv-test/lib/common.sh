#!/usr/bin/env bash
# Shared config for remote honeypot trap simulation (curl only).
# shellcheck disable=SC2034

set -euo pipefail

_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${_SCRIPT_DIR}/config.env" ]]; then
  # shellcheck source=/dev/null
  source "${_SCRIPT_DIR}/config.env"
fi

# TARGET = IP or DNS of the admin-panel host (port 3000 by default).
TARGET="${TARGET:-${HOST:-localhost}}"
PORT="${PORT:-3000}"
SCHEME="${SCHEME:-http}"
GATEWAY_PATH="${GATEWAY_PATH:-/gateway}"
PAUSE="${PAUSE:-1.5}"
CURL_MAX_TIME="${CURL_MAX_TIME:-120}"

# Strip trailing slashes
GATEWAY_PATH="${GATEWAY_PATH%/}"
UI_BASE="${SCHEME}://${TARGET}:${PORT}"
BASE="${UI_BASE}${GATEWAY_PATH}"
COOKIE="${COOKIE_JAR:-${TMPDIR:-/tmp}/evation-remote-$$.cookie}"

export TARGET PORT SCHEME GATEWAY_PATH UI_BASE BASE COOKIE CURL_MAX_TIME

_common_cleanup() {
  if [[ "${KEEP_COOKIE:-0}" != "1" ]]; then
    rm -f "$COOKIE"
  fi
}

_common_init() {
  rm -f "$COOKIE"
  echo "→ Target: ${BASE}/"
  echo "→ Cookie jar: ${COOKIE}"
  echo ""
}

gw_curl() {
  curl -sL -c "$COOKIE" -b "$COOKIE" --max-time "$CURL_MAX_TIME" "$@"
}

step() {
  local label="$1"
  local desc="$2"
  shift 2
  echo "[${label}] ${desc}"
  "$@"
  echo ""
  sleep "$PAUSE"
}

print_trace() {
  local trace
  trace=$(grep -E 'attacker_trace_id' "$COOKIE" 2>/dev/null | awk '{print $NF}' | tail -1 || true)
  echo "Done."
  if [[ -n "$trace" ]]; then
    echo "traceId: ${trace}"
  fi
  echo "Dashboard: ${UI_BASE}${GATEWAY_PATH}/dashboard/"
}

require_target() {
  if [[ -z "${TARGET}" || "${TARGET}" == "CHANGE_ME" ]]; then
    echo "Set TARGET (IP or DNS), e.g.: TARGET=192.168.1.50 ./run-all.sh" >&2
    exit 1
  fi
}
