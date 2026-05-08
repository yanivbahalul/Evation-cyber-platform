# 🛡️ HIT Evation Cyber — Section 3: Telemetry, Logging & Data Extraction

**Lead Engineer:** Max
**Domain:** Threat Intelligence, Real-time Data Piping, and Air-Gapped Database Management.

This document explains every file in Max's part of the project, how the pieces fit together, and the contracts that connect this section to the work of Sagiv (Section 1, gateway), Bar (Section 2, deception engine), and Yaniv (Section 4, admin dashboard).

---

## 1. The "Black Box" Principle

The system is a logically air-gapped telemetry engine. Its job is to:

1. **Identify** every attacker that hits a trap (fingerprint, IP, geolocation).
2. **Persist** every attack event into an isolated "Malicious" MongoDB cluster — physically unable to reach the legitimate Safe Zone DB.
3. **Stream** sub-second alerts to the Blue Team's React dashboard via a token-gated WebSocket.
4. **Survive** flood attempts without dropping legitimate logs or crashing.

Everything in this section is designed so that a compromise of the honeypot can never pivot into the real application's data.

---

## 2. Directory Map

```
├── config/
│   └── maliciousDb.js           Air-gapped Mongoose connection + model registration
├── constants/
│   └── trapTypes.js             Enum of trap categories (SQLI, XSS, DATA_BOMB, BRUTE_FORCE)
├── middlewares/
│   ├── fingerprint.js           User-Agent → JSON fingerprint on req.attackerFingerprint
│   ├── logLimiter.js            In-memory flood guard (>30 hits / 5s = silenced)
│   └── telemetryTracker.js      Wraps decoy routes; the integration entry point for Bar
├── models/
│   ├── AttackerProfile.js       Persistent "criminal record" per IP
│   ├── AttackEvent.js           One row per trap trigger
│   └── HoneyToken.js            Bait credentials + trigger forensics
├── services/
│   ├── LoggerService.js         Winston console + Mongoose persistence to attack_events
│   └── SocketService.js         Socket.io server, token-gated, broadcasts liveAlert
├── tests/
│   └── mockAttack.js            End-to-end smoke test (handshake → trap → liveAlert)
├── utils/
│   └── getAttackerIp.js         Resolves real client IP behind Nginx / proxies
├── testServer.js                Standalone Express server for local development
├── .env                         MALICIOUS_DB_URI + ADMIN_SOCKET_TOKEN
└── package.json
```

---

## 3. File-by-File

### `config/maliciousDb.js`
Opens a dedicated `mongoose.createConnection()` to the Malicious DB so it has its own connection pool — independent from anything Sagiv's safe-zone code does. Lazy-singleton pattern: first call connects, every subsequent call returns the cached connection. Registers all three Mongoose models (`AttackerProfile`, `AttackEvent`, `HoneyToken`) against this connection so callers retrieve them via `conn.model('Name')`.

**Contract for the team:** Anyone who needs to read or write Malicious-DB data does:
```js
const conn = require('./config/maliciousDb')();
const AttackerProfile = conn.model('AttackerProfile');
```

### `constants/trapTypes.js`
A frozen enum: `SQLI`, `XSS`, `DATA_BOMB`, `BRUTE_FORCE`. The `AttackEvent` schema validates `trapType` against this enum, so passing an unknown string fails at write time. Bar uses these values when calling `telemetryTracker(TRAP_TYPES.X)`.

### `middlewares/fingerprint.js`
Runs app-wide. Requires `app.use(useragent.express())` to be installed first (in `testServer.js`). Reads `req.useragent` and assembles `req.attackerFingerprint`:

```
{
    os, platform, browser, version, browserVersion,
    deviceType: 'Mobile' | 'Desktop',
    isBot: boolean,
    riskScore: number   // per-event base score (+50 if bot UA, else 0)
}
```

The `riskScore` here is the *contribution* of this single request. The running total per-attacker lives on `AttackerProfile.riskScore` and is incremented in `telemetryTracker`.

### `middlewares/logLimiter.js`
Defends against log-flooding attacks. Maintains an in-memory `Map<ip, timestamp[]>`, prunes entries older than 5 seconds, and if any IP exceeds **30 hits in 5 seconds** flags `req.isLogFlooding = true`. The telemetry tracker then skips DB writes and socket broadcasts for that request — keeping Mongo and the dashboard healthy under attack — while still upserting the `AttackerProfile` so the IP isn't "rewarded" with invisibility.

### `middlewares/telemetryTracker.js`
**The single integration point for Bar.** Wrap any decoy route with `telemetryTracker(trapType)` and the rest is automatic.

On every request to a wrapped route:
1. Records `startTime` at trap entry.
2. Hooks `res.on('finish')` so wasted time is computed *only after* the response completes.
3. On finish: extracts IP, payload, and `res.locals.bytes_sent` (Bar stamps this for the data bomb).
4. Builds the canonical `attackData` payload (snake_case `wasted_time_ms`, `bytes_sent`).
5. If not flooded: calls `LoggerService.logAttack` (DB persist + console log) and `SocketService.emitLiveAlert` (broadcast to Yaniv).
6. Always: upserts `AttackerProfile` with `$set` for the latest fingerprint, `$inc` on `riskScore`, and `$setOnInsert` for `firstSeen`. GeoIP city / lat / lng come from `geoip-lite`.

### `models/AttackerProfile.js`
Persistent profile per IP. Schema:

| Field | Type | Notes |
|-------|------|-------|
| `ip` | String, unique | PK |
| `city`, `lat`, `lng` | from `geoip-lite` | for Yaniv's Leaflet map |
| `os`, `platform`, `browser`, `deviceType` | strings | from User-Agent |
| `isBot` | Boolean | bot UA detected |
| `riskScore` | Number, default 0 | accumulates via `$inc` on every event |
| `firstSeen`, `lastSeen` | Date | for "recent activity" filters |

### `models/AttackEvent.js`
One document per trap trigger. Pinned to collection `attack_events`. Schema:

| Field | Type | Notes |
|-------|------|-------|
| `eventID` | String (UUID v4) | PDF-spec PK; auto-generated by `crypto.randomUUID` |
| `attackerIp` | String, indexed | for joins to `AttackerProfile.ip` |
| `trapType` | String, enum | from `TRAP_TYPES` |
| `payload` | String | raw malicious string the attacker sent |
| `wasted_time_ms` | Number | request lifetime in ms |
| `bytes_sent` | Number | bandwidth burned (Bar stamps this for streams) |
| `timestamp` | Date | event time |

### `models/HoneyToken.js`
Bait credentials. PDF-aligned fields (`fakeUsername`, `fakePassword`, `isTriggered`) plus an additive `triggeredLogs[]` array so every use of the bait is captured with `attackerIp`, `timestamp`, and `networkContext` (e.g. SSH, HTTP, SMTP). Bar may use the simple flat shape; deeper telemetry uses the array.

### `services/LoggerService.js`
A Winston logger with **console transport only** — no `winston-mongodb`. Persistence is done via Mongoose against the isolated connection so the schema in `models/AttackEvent.js` is the single source of truth.

Public API:
- `LoggerService.logAttack(attackData)` — async; persists an `AttackEvent` and prints a console line. Accepts either a precomputed `wasted_time_ms` or a `startTime` it can subtract from `Date.now()`.
- `LoggerService.calculateWastedTime(startTime)` — small helper Bar can use mid-trap if he wants the delta without going through `logAttack`.

Errors during persistence are caught and logged — they never crash the request.

### `services/SocketService.js`
Server-side `socket.io` with a token-gated handshake (the **Phase 4 mitigation against "Zombie Connections"** — anonymous attackers can't open millions of sockets to crash the dashboard). The token is read from `process.env.ADMIN_SOCKET_TOKEN` (fallback `'admin-secret'` for dev).

Public API:
- `init(httpServer)` — call once from the entry point with the raw HTTP server.
- `emitLiveAlert(trapData)` — broadcasts on the `liveAlert` event.

The top of the file contains a complete README block for Yaniv: how to connect from React, what event to listen for, and the exact JSON payload shape.

### `tests/mockAttack.js`
End-to-end smoke test runnable as `npm run mock-attack`. Connects with the auth token, listens for `liveAlert`, hits `GET /test-trap` to fire the pipeline, validates the payload key set, and exits 0 (success) or 1 (any link broken). Hard-timeout at 10 seconds.

### `utils/getAttackerIp.js`
Priority resolver: `X-Forwarded-For` (first hop) → `X-Real-IP` → `req.socket.remoteAddress` → `req.ip`. The first two are injected by Sagiv's Nginx reverse proxy.

### `testServer.js`
Standalone Express harness for local development. Wires every middleware in the correct order:
1. `useragent.express()` — populates `req.useragent`.
2. `fingerprintMiddleware` — populates `req.attackerFingerprint`.
3. `logLimiter` — flags `req.isLogFlooding`.
4. Decoy routes wrapped with `telemetryTracker(trapType)`.

`SocketService.init(http)` runs once at boot, and `connectMaliciousDB()` opens the isolated connection eagerly so the DB is ready before any traffic.

---

## 4. The Lifecycle of an Attack

```
Attacker → Sagiv's Nginx (X-Forwarded-For) → Express
  └── useragent.express()        →  req.useragent
  └── fingerprintMiddleware      →  req.attackerFingerprint
  └── logLimiter                 →  req.isLogFlooding (maybe)
  └── Bar's decoy route wrapped with telemetryTracker(trapType)
        ├── trap runs (data bomb / tarpit / fake login / sandbox XSS)
        └── res.on('finish'):
              ├── LoggerService.logAttack →  AttackEvent.create() in attack_events
              ├── SocketService.emitLiveAlert →  WebSocket to Yaniv's React dashboard
              └── AttackerProfile.findOneAndUpdate (upsert, $inc riskScore)
```

The `res.on('finish')` hook is critical: it guarantees we only measure wasted time *after* the response is done, not at controller-entry.

---

## 5. Integration Contracts

### With Sagiv (Section 1 — Gateway)
- He injects `X-Forwarded-For` and `X-Real-IP`. We consume them via `getAttackerIp(req)`.
- His `silentReroute()` mutates `req.url` to point at Bar's decoy controller. By the time `telemetryTracker` runs, the routing has already been settled — we don't care that the original URL was different.

### With Bar (Section 2 — Deception)
- He wraps every decoy route with `telemetryTracker(TRAP_TYPES.X)`.
- For the Data Bomb specifically: he stamps `res.locals.bytes_sent = stream.bytesRead` on stream close so bandwidth is measured.
- He may use `HoneyToken` directly via the malicious connection if he wants to seed/track bait credentials.
- He does **not** import `LoggerService` or `SocketService` — the wrapper handles everything.

### With Yaniv (Section 4 — Dashboard)
- His React SPA connects with `socket.io-client`, auth token from `ADMIN_SOCKET_TOKEN`.
- He listens on `liveAlert` for the documented JSON payload shape.
- For historical data and stats panels he reads `attack_events` and `attackerprofiles` collections directly via Mongoose (same `MALICIOUS_DB_URI`).
- His Admin REST API (`POST /api/admin/login`, `GET /api/admin/attackers`, etc.) lives in the same Node.js process as Max's code — it's all one backend.

---

## 6. How To Run

```bash
# install deps
npm install

# start the standalone test server
npm start                    # runs testServer.js on :3000

# in another terminal — end-to-end smoke test
npm run mock-attack
```

Successful smoke test prints five ✅ lines (handshake, alert received, payload shape OK, /test-trap completed) and exits 0.

---

## 7. Environment Variables

| Var | Purpose |
|-----|---------|
| `MALICIOUS_DB_URI` | MongoDB Atlas connection string for the air-gapped honeypot DB |
| `ADMIN_SOCKET_TOKEN` | Shared secret the dashboard must send during the socket handshake |

Never commit the `.env` file to git. Share secrets via DM, not the repo.

---

## 8. Design Decisions Worth Defending

- **No `winston-mongodb`** — persistence goes through Mongoose so the schema in `AttackEvent.js` is the single source of truth. Winston handles only the human-readable console line.
- **Air-gap via `mongoose.createConnection()`** — the Malicious DB has its own connection pool. There is no code path through which a query against `ATTACKER_PROFILE` can ever hit the Safe Zone's `ADMIN_USER` collection.
- **`riskScore` accumulates with `$inc`** — a persistent attacker ramps up over time instead of being pinned at the value of their last single request.
- **Token-gated WebSocket handshake** — protects against "Zombie Connections" where an attacker opens millions of sockets to exhaust the server.
- **Snake-case for metric fields (`wasted_time_ms`, `bytes_sent`)** — matches the PDF spec on page 9 and keeps the on-the-wire shape consistent with what Yaniv's React state expects.
- **Screen resolution is intentionally NOT collected from headers** — it isn't carried by any HTTP header (browsers can only measure their own dimensions after JavaScript runs). The spec's wording on this was technically incorrect; we replaced the field with `platform` and `isBot`, which *are* available at the header level.
