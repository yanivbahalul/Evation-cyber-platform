#!/bin/sh
set -eu

PUBLIC_PORT="${PUBLIC_PORT:-3000}"
H="${PUBLIC_HOST:-${DEV_PUBLIC_HOST:-}}"

# Start gateway, then print Access URL after it is listening.
# (We detect readiness via the gateway's own "server_listening" log line.)
if [ -n "${H}" ]; then
  ACCESS_URL="http://${H}:${PUBLIC_PORT}/gateway/"
else
  ACCESS_URL=""
fi

exec sh -c "node app.js 2>&1 | awk -v access_url=\"${ACCESS_URL}\" '
  { print }
  /server_listening/ && access_url != \"\" && !printed {
    print \"Access URL: \" access_url
    printed=1
  }
'"

