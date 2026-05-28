#!/usr/bin/env bash
# Shared config for remote honeypot trap simulation (curl only).
# shellcheck disable=SC2034

set -euo pipefail

_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${_SCRIPT_DIR}/config.env" ]]; then
  # shellcheck source=/dev/null
  source "${_SCRIPT_DIR}/config.env"
fi

# Base site URL/IP (recommended). Examples:
#   BASE_URL=https://xxxx.trycloudflare.com
#   BASE_URL=http://192.168.0.89:3000
#   BASE_URL=192.168.0.89:3000
# If BASE_URL includes a path, we use it to infer GATEWAY_PATH when possible.
BASE_URL="${BASE_URL:-}"

# Legacy knobs (still supported):
#   TARGET=192.168.0.89 PORT=3000 SCHEME=http
TARGET="${TARGET:-${HOST:-}}"

# Default port: stack is exposed via nginx on 3000 (not 8080).
# If you use BASE_URL with https (trycloudflare.com), omit the port.
PORT="${PORT:-3000}"
SCHEME="${SCHEME:-http}"
GATEWAY_PATH="${GATEWAY_PATH:-/gateway}"
PAUSE="${PAUSE:-1.5}"
CURL_MAX_TIME="${CURL_MAX_TIME:-120}"

# Parse a base URL / host:port into SCHEME/TARGET/PORT and optionally infer GATEWAY_PATH.
_parse_base_url() {
  local input="$1"
  local url="$1"

  # Trim whitespace
  url="${url#"${url%%[![:space:]]*}"}"
  url="${url%"${url##*[![:space:]]}"}"

  # If user provided just a host/IP (no scheme), assume http://
  if [[ "$url" != *"://"* ]]; then
    url="http://${url}"
  fi

  # scheme
  if [[ "$url" =~ ^([a-zA-Z][a-zA-Z0-9+.-]*)://(.*)$ ]]; then
    SCHEME="${BASH_REMATCH[1]}"
    url="${BASH_REMATCH[2]}"
  fi

  # split host[:port] and optional path
  local hostport path
  hostport="${url%%/*}"
  path="/${url#*/}"
  if [[ "$url" == "$hostport" ]]; then
    path=""
  fi

  # host and port
  PORT="" # set only if explicitly provided in BASE_URL
  if [[ "$hostport" =~ ^\[(.*)\]:(.+)$ ]]; then
    TARGET="${BASH_REMATCH[1]}"
    PORT="${BASH_REMATCH[2]}"
  elif [[ "$hostport" =~ ^\[(.*)\]$ ]]; then
    TARGET="${BASH_REMATCH[1]}"
  elif [[ "$hostport" == *":"* ]]; then
    TARGET="${hostport%%:*}"
    PORT="${hostport##*:}"
  else
    TARGET="$hostport"
  fi

  # Infer gateway path if provided in input and looks like /gateway...
  if [[ -n "$path" ]]; then
    if [[ "$path" == "/gateway" || "$path" == "/gateway/" || "$path" == /gateway/* ]]; then
      GATEWAY_PATH="/gateway"
    fi
  fi
}

# If nothing configured, prompt once.
_prompt_base_url_if_needed() {
  if [[ -n "${BASE_URL}" ]]; then
    _parse_base_url "${BASE_URL}"
    return
  fi
  if [[ -n "${TARGET}" ]]; then
    return
  fi

  if [[ -t 0 ]]; then
    echo "Enter site URL or IP (examples: https://xxxx.trycloudflare.com  |  http://192.168.0.89:3000):"
    read -r BASE_URL
    if [[ -n "${BASE_URL}" ]]; then
      _parse_base_url "${BASE_URL}"
    fi
  fi
}

_prompt_base_url_if_needed

# Strip trailing slashes
GATEWAY_PATH="${GATEWAY_PATH%/}"
if [[ -n "${PORT:-}" ]]; then
  UI_BASE="${SCHEME}://${TARGET}:${PORT}"
else
  UI_BASE="${SCHEME}://${TARGET}"
fi
BASE="${UI_BASE}${GATEWAY_PATH}"
COOKIE="${COOKIE_JAR:-${TMPDIR:-/tmp}/evation-remote-$$.cookie}"

export BASE_URL TARGET PORT SCHEME GATEWAY_PATH UI_BASE BASE COOKIE CURL_MAX_TIME

_common_cleanup() {
  if [[ "${KEEP_COOKIE:-0}" != "1" ]]; then
    rm -f "$COOKIE"
  fi
}

_common_init() {
  if [[ "${KEEP_COOKIE:-0}" != "1" ]]; then
    rm -f "$COOKIE"
  fi
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
    echo "Set BASE_URL or TARGET, e.g.:" >&2
    echo "  BASE_URL=https://xxxx.trycloudflare.com ./run-all.sh" >&2
    echo "  TARGET=192.168.0.89 PORT=3000 ./run-all.sh" >&2
    exit 1
  fi
}
