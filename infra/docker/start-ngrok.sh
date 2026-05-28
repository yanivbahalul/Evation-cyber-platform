#!/bin/sh
set -eu

TARGET_URL="${1:-http://nginx:80}"

if [ -z "${NGROK_AUTHTOKEN:-}" ]; then
  echo "ngrok error: missing NGROK_AUTHTOKEN (set it in infra/.env)"
  exit 1
fi

# Configure ngrok
ngrok config add-authtoken "${NGROK_AUTHTOKEN}" >/dev/null 2>&1 || true

# Prefer ngrok local API (explicitly enabled), and fall back to log parsing.
# Print the public URL once, then keep ngrok running.
ngrok http "${TARGET_URL}" \
  --web-addr=127.0.0.1:4040 \
  --log=stdout --log-format=term --log-level=info \
  >/tmp/ngrok.log 2>&1 &
pid="$!"

printed=0
printed_wait=0

while kill -0 "$pid" >/dev/null 2>&1; do
  if [ "$printed" -eq 0 ]; then
    # Try local API first
    pub="$(curl -fsS "http://127.0.0.1:4040/api/tunnels" 2>/dev/null \
      | sed -n 's/.*"public_url":"\([^"]*\)".*/\1/p' \
      | head -n 1 || true)"
    if [ -n "$pub" ]; then
      echo "$pub"
      printed=1
    else
      # Fallback: parse logs for any https URL containing "ngrok"
      url="$(sed -n 's/.*\(https:\/\/[^ ]*ngrok[^ ]*\).*/\1/p' /tmp/ngrok.log | head -n 1 || true)"
      if [ -n "$url" ]; then
        echo "$url"
        printed=1
      fi
    fi
  fi

  if [ "$printed" -eq 0 ] && [ "$printed_wait" -eq 0 ]; then
    # Avoid silent confusion: print one status line, then stay quiet.
    echo "ngrok: waiting for public URL..."
    printed_wait=1
  fi

  sleep 0.5
done

echo "ngrok error: ngrok process exited (see /tmp/ngrok.log)"
exit 1

