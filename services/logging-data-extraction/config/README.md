# Telemetry Config

> **Owner:** Max · **Mission 3.3** — Air-gapped database

| File | Purpose |
|------|---------|
| `maliciousDb.js` | Isolated Mongoose connection to the malicious MongoDB |

This dedicated connection pool (`mongoose.createConnection()`) guarantees an attacker
cannot pivot from honeypot data into the safe system.

**Requires** `MALICIOUS_DB_URI` and `ADMIN_SOCKET_TOKEN` in the environment.
