# Telemetry service (logging-data-extraction)

The telemetry service is the **sole owner of the malicious DB**. The gateway never
connects to Mongo for attack data — it reports traps over HTTP and this service
performs every write, read, and live broadcast.

## Layout

```
server.js                     Express + HTTP + Socket.IO entry point (port 3002)
routes/internal.js            Bearer-gated /internal/* API (see below)
services/
  AttackEventService.js       Writes AttackEvent documents (attack_events)
  AttackerProfileService.js   Upserts AttackerProfile, screen-resolution, banned-IP reads
  honeyTokenService.js        HoneyToken create / check / usage
  SocketService.js            Socket.IO server + liveAlert broadcast
  geoService.js               IP → geo (geoip-lite + online fallback, cached)
config/maliciousDb.js         Isolated malicious-DB connection (db-schemas factory)
utils/buildAttackEvent.js     Normalizes a trap payload into AttackEvent fields
tests/mockAttack.js           Socket + /test-trap smoke test (npm run mock-attack)
```

## Internal API (all require `Authorization: Bearer <ADMIN_SOCKET_TOKEN>`)

| Route | Purpose |
|-------|---------|
| `POST /internal/attack` | Write AttackEvent + upsert AttackerProfile + broadcast `liveAlert` |
| `POST /internal/honey-token` | Persist an issued bait credential |
| `GET /internal/honey-token/check?value=` | Check if a value is an issued honey-token |
| `POST /internal/honey-token/usage` | Flag a honey-token as used |
| `GET /internal/banned-ips` | Banned-IP set for gateway enforcement |
| `POST /internal/screen-resolution` | Beacon update for an existing attacker profile |

`POST /internal/live-alert` is kept as a backward-compatible alias of `/internal/attack`.

## Shared building blocks

- Schemas + the `createMaliciousConnection()` factory live in `@evation/db-schemas`.
- `attackLog` (structured console logging) and `fingerprint` live in `@evation/shared-utils`.
- `TRAP_TYPES` lives in `@evation/shared-constants`.

## Local smoke test

```bash
npm start            # server.js on :3002 (requires MALICIOUS_DB_URI + ADMIN_SOCKET_TOKEN)
npm run mock-attack  # connects a socket, fires /test-trap, asserts the liveAlert shape
```
