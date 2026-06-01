## MIDDLEWARE

Owner: Sagiv Levy (Mission 1.2 — Gatekeeper)

Files:
  gatekeeper.js       IP ban check, SQLi/XSS regex on body/query, scanner UA
  decoyReroute.js     Silent reroute: mutates req.url to decoy routes (no 302)
  auth.js             Session and role for real employees
  honeyTokenDetector.js  Detects Bearer honey-token usage (works with Bar traps)

Responsibilities doc:
  checkIP — O(1) blacklist lookup
  detectSQLi and detectXSS — ReDoS-safe patterns in detectionService.js
  silentReroute — under 50ms handoff to decoy controller

Bar owns what happens AFTER reroute (decoyController + traps).
