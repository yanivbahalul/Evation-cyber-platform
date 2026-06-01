## SERVICES


Two Node.js backends:

  innotech-gateway/         Port 4001 — HR portal + traps (Sagiv + Bar)
  logging-data-extraction/  Port 3002 — Telemetry only (Max)

Flow:
  Browser → admin-panel → gateway detects attack → POST /internal/attack → telemetry
  → malicious MongoDB + Socket.IO → admin-panel dashboard updates live.

See each service folder for "README.md".
