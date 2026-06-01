#!/bin/sh
set -eu

TARGET_URL="${1:-http://nginx:80}"

if [ -z "${NGROK_AUTHTOKEN:-}" ]; then
  echo "[EVATION] ngrok error: missing NGROK_AUTHTOKEN (set it in infra/.env)"
  exit 1
fi

# ngrok v3 reads NGROK_AUTHTOKEN from the environment (no --web-addr flag in v3).
# --pooling-enabled avoids ERR_NGROK_334 when the same free hostname restarts in Docker.
ngrok http "${TARGET_URL}" \
  --pooling-enabled \
  --log=stdout --log-format=term --log-level=warn \
  >/tmp/ngrok.log 2>&1 &
pid="$!"

printed=0

while kill -0 "$pid" >/dev/null 2>&1; do
  if [ "$printed" -eq 0 ]; then
    pub="$(curl -fsS "http://127.0.0.1:4040/api/tunnels" 2>/dev/null \
      | sed -n 's/.*"public_url":"\([^"]*\)".*/\1/p' \
      | head -n 1 || true)"
    if [ -z "$pub" ]; then
      pub="$(sed -n 's/.*\(https:\/\/[^ ]*ngrok[^ ]*\).*/\1/p' /tmp/ngrok.log | head -n 1 || true)"
    fi
    if [ -n "$pub" ]; then
      echo "[EVATION] public tunnel: ${pub}"
      printed=1
      wait "$pid"
      exit 0
    fi
  fi
  sleep 0.5
done

wait "$pid" 2>/dev/null || true

echo "[EVATION] ngrok error: process exited"
if [ -f /tmp/ngrok.log ]; then
  grep -E '^(ERROR:|t=.*lvl=eror|t=.*lvl=crit)' /tmp/ngrok.log | tail -n 8 || tail -n 12 /tmp/ngrok.log
fi
exit 1
