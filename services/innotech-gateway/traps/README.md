# Traps

**Owner:** Bar (Mission 2.2 — Trap implementation)

## Files

| File | Purpose |
|------|---------|
| `dataBomb.js` | Streams large fake download (bandwidth waste) |
| `fakeLogin.js` | Simulated brute-force lockout delays |
| `honeyToken.js` | Fake API keys page + trackable credentials |
| `sandboxXSS.js` | Safe XSS logging environment |
| `tarpit.js` | Slow fake DB errors (holds connection open) |
| `httpTrickle.js` | Slow HTTP response trickle |
| `infiniteRedirect.js` | Redirect loop decoy |

## Goal

Waste attacker CPU, bandwidth, and time without crashing the host. Uses streams and async delays so the Node event loop stays non-blocking.

Each trap reports to telemetry via `utils/telemetryClient.js` (Max's pipeline).
