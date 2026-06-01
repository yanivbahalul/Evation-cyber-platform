INNOTECH GATEWAY (honeypot HR portal)
Port 4001. Express + EJS.

Owners:
  Sagiv Levy — Safe zone, Gatekeeper, real routes, auth, safezone DB
  Bar        — Decoy controller, traps, decoy EJS pages

What is here:
  middleware/   gatekeeper (SQLi/XSS/scan), decoyReroute, auth, honeyTokenDetector
  controllers/  realController (legit HR), decoyController (traps)
  traps/        dataBomb, fakeLogin, honeyToken, sandboxXSS, tarpit, etc.
  views/        Real HR pages; views/decoy/ = fake vulnerable UIs
  services/     detectionService, banService, telemetry client
  models/       Local gateway models (also uses packages/db-schemas)
  config/       App configuration
  public/       CSS and static files for safezone UI
  utils/        Cookies, telemetry HTTP client, TOTP crypto

Gateway does NOT write to malicious DB — only reports to Max's telemetry service.
