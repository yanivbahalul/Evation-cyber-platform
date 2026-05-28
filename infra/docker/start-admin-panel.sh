#!/bin/sh
set -eu

# Start Next.js server, but hide its default startup banner lines.
exec sh -c 'node apps/admin-panel/server.js 2>&1 | awk "
  /^▲ Next\\.js / { next }
  /^- Local:[[:space:]]/ { next }
  /^- Network:[[:space:]]/ { next }
  /^✓ Ready / { next }
  { print }
"'

