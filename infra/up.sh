#!/usr/bin/env bash
set -euo pipefail

# Start docker-compose with PUBLIC_HOST auto-detected (no localhost fallback).
# macOS: prefer Wi‑Fi (en0), then Ethernet (en1).

detect_ip() {
  local ip=""
  ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [[ -z "${ip}" ]]; then
    ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [[ -z "${ip}" ]]; then
    return 1
  fi
  printf '%s' "${ip}"
}

PUBLIC_HOST="${PUBLIC_HOST:-}"
if [[ -z "${PUBLIC_HOST}" ]]; then
  PUBLIC_HOST="$(detect_ip)" || {
    echo "Could not auto-detect LAN IP. Set PUBLIC_HOST manually, e.g.:"
    echo "  PUBLIC_HOST=192.168.x.x ./up.sh"
    exit 1
  }
fi

export PUBLIC_HOST
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"

echo "Using PUBLIC_HOST=${PUBLIC_HOST}"
docker compose up -d --build --force-recreate

echo
echo "Access URL: http://${PUBLIC_HOST}:3000"
echo "Gateway URL: http://${PUBLIC_HOST}:3000/gateway/"
