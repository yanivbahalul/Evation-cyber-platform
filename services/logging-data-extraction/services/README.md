# Telemetry Services

> **Owner:** Max

The business logic behind the internal API.

| File | Responsibility |
|------|----------------|
| `AttackEventService.js` | Writes documents to the `attack_events` collection |
| `AttackerProfileService.js` | Upserts attacker profiles; reads banned IPs |
| `honeyTokenService.js` | Honey-token create / check / usage |
| `SocketService.js` | Socket.IO server + `liveAlert` broadcast (Mission 3.2) |
| `geoService.js` | IP → latitude/longitude for the dashboard map (feeds Mission 4.3) |
| `LoggerService.js` | Structured logging and metrics such as `wasted_time_ms` |

- **Mission 3.1** — User-Agent and header fingerprinting into JSON attacker profiles.
- **Mission 3.3** — all writes go through a separate Mongoose connection, so there is zero
  cross-contamination with the safezone database.
