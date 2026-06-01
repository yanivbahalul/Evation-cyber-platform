# Traps

> **Owner:** Bar · **Mission 2.2** — Trap implementation & memory management

Each module wastes an attacker's CPU, bandwidth, and time **without** destabilizing the
host. Streams and async delays keep the Node event loop free for real users.

## Modules

| File | Trap | Technique |
|------|------|-----------|
| `dataBomb.js` | Data bomb | Streams huge fake download with backpressure (`stream.pipe(res)`) so RAM stays flat |
| `tarpit.js` | Tarpit | Slow fake DB errors via `setTimeout` + Promises — holds the connection open |
| `fakeLogin.js` | Brute-force | Simulated delayed lockout on repeated login attempts |
| `honeyToken.js` | Honey token | Serves trackable fake credentials / API keys |
| `sandboxXSS.js` | XSS sandbox | Safe DOM that logs the payload instead of executing it |
| `httpTrickle.js` | HTTP trickle | Drips the response a few bytes at a time |
| `infiniteRedirect.js` | Redirect loop | Endless redirect decoy |

## Reporting

After firing, each trap calls [`../utils/telemetryClient.js`](../utils) to report the event to the
telemetry service (Max), which persists it and pushes a live alert to the dashboard (Yaniv).
