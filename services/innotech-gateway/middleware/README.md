# Gatekeeper Middleware

> **Owner:** Sagiv Levy · **Mission 1.2** — Gatekeeper traffic middleware

The custom Express pipeline that inspects every request with near-zero overhead and
decides whether a visitor is a real employee or an attacker.

## Files

| File | Purpose |
|------|---------|
| `gatekeeper.js` | IP-ban check, SQLi/XSS regex scan of `req.body`/`req.query`, scanner User-Agent detection |
| `decoyReroute.js` | **Silent reroute** — mutates `req.url` to a decoy route and calls `next()` (no HTTP 302) |
| `auth.js` | Session and role handling for real employees |
| `honeyTokenDetector.js` | Flags requests that carry a Bearer honey-token |

## Design goals (from the spec)

- **`checkIP`** — O(1) lookup against an in-memory blacklist.
- **`detectSQLi` / `detectXSS`** — ReDoS-safe regex (no catastrophic backtracking); pattern lists live in [`../services/detectionService.js`](../services/detectionService.js).
- **`silentReroute`** — invisible handoff to the decoy controller in under 50 ms, so the attacker never sees a redirect.

Once a request is rerouted, **Bar's** [`../controllers/decoyController.js`](../controllers) and [`../traps/`](../traps) take over.
