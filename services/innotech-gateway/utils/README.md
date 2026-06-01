# Gateway Utils

Small helpers used across the gateway.

| File | Owner | Purpose |
|------|-------|---------|
| `telemetryClient.js` | Bar + Max | Reports every trap to the telemetry `POST /internal/attack` endpoint |
| `authCookies.js` | Sagiv | Sets/reads safezone session cookies |
| `adminTotpCrypto.js` | Sagiv + Yaniv | TOTP helpers for gateway admin login |

After a trap fires, `telemetryClient` is what makes the event show up live on the
dashboard (Max → Yaniv).
