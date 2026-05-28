#!/bin/sh
set -eu

# Usage: /start-cloudflared.sh http://nginx:80
TARGET_URL="${1:-http://nginx:80}"

printed_url=0
printed_wait=0
printed_err=0
start_ts="$(date +%s)"

# Run quick tunnel and parse output.
cloudflared tunnel --no-autoupdate --url "${TARGET_URL}" 2>&1 | while IFS= read -r line; do
  now_ts="$(date +%s)"
  elapsed="$((now_ts - start_ts))"

  # If it takes too long to get a URL, print a single waiting line (then stay quiet).
  if [ "${printed_url}" -eq 0 ] && [ "${printed_wait}" -eq 0 ] && [ "${elapsed}" -ge 20 ]; then
    echo "cloudflared: waiting for trycloudflare URL..."
    printed_wait=1
  fi

  # Print the first trycloudflare URL we see, and stay quiet afterwards.
  if [ "${printed_url}" -eq 0 ]; then
    case "${line}" in
      *https://*.trycloudflare.com*)
        url="$(printf '%s' "${line}" | sed -n 's/.*\(https:\/\/[A-Za-z0-9.-]\+\.trycloudflare\.com\).*/\1/p')"
        if [ -n "${url}" ]; then
          echo "${url}"
          printed_url=1
        fi
        ;;
    esac
  fi

  # If cloudflared errors before giving a URL, print a single error line so it's debuggable.
  if [ "${printed_url}" -eq 0 ] && [ "${printed_err}" -eq 0 ]; then
    case "${line}" in
      *" ERR "*|*error*|*Error*|*failed*|*Failed*)
        echo "cloudflared error: ${line}"
        printed_err=1
        ;;
    esac
  fi
done

