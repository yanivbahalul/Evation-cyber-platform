# Internal API Routes

> **Owner:** Max

`internal.js` exposes the internal API used by the gateway and the admin panel. **Every
route requires** `Authorization: Bearer <ADMIN_SOCKET_TOKEN>`.

| Method & path | Purpose |
|---------------|---------|
| `POST /internal/attack` | Write `AttackEvent`, upsert `AttackerProfile`, broadcast `liveAlert` |
| `POST /internal/honey-token` | Persist an issued bait credential |
| `GET /internal/honey-token/check?value=` | Check whether a value is a known honey-token |
| `POST /internal/honey-token/usage` | Flag a honey-token as used |
| `GET /internal/banned-ips` | Banned-IP set for gateway enforcement (Sagiv) |
| `POST /internal/screen-resolution` | Attacker fingerprint beacon |

`POST /internal/live-alert` is kept as a backward-compatible alias of `/internal/attack`.

**Mission 3.2:** a sub-second WebSocket alert reaches Yaniv's dashboard after each trap.
