LOGGING DATA EXTRACTION (telemetry)
Owner: Max (Mission 3 — Telemetry, Logging and Data Extraction)
Port 3002. Sole owner of malicious MongoDB writes.

What is here:
  server.js              Express + Socket.IO entry
  routes/internal.js     Bearer-gated POST /internal/attack, honey-token, banned-ips
  services/              Attack events, profiles, geo, Socket.IO, honey tokens
  config/maliciousDb.js  Isolated mongoose connection (air-gapped from safezone)
  utils/                 buildAttackEvent normalization
  tests/                 geoService tests, mock attack smoke test
  scripts/               backfillGeo, verifyQaEvents

Gateway (Sagiv/Bar) never touches malicious DB — only HTTP to this service.

Also see ARCHITECTURE.md in this folder (technical reference).
