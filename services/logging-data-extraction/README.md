# Logging & Data Extraction (Telemetry)

> **Owner:** Max · **Mission 3** — Telemetry, Logging & Data Extraction
> **Stack:** Express + Socket.IO · **Port:** `3002`

The threat-intelligence brain of the platform. It is the **sole owner of the malicious
database**: the gateway reports traps over HTTP, and this service performs every write,
read, and live broadcast.

## Folder map

| Path | What's inside |
|------|---------------|
| `server.js` | Express + HTTP + Socket.IO entry point |
| [`routes/`](routes/) | Bearer-gated `/internal/*` API (attack, honey-token, banned-ips) |
| [`services/`](services/) | Attack events, attacker profiles, geo lookup, Socket.IO, honey tokens |
| [`config/`](config/) | Isolated malicious-DB connection (air-gapped from safezone) |
| [`utils/`](utils/) | `buildAttackEvent` payload normalization |
| [`tests/`](tests/) | Geo unit tests + mock-attack smoke test |
| [`scripts/`](scripts/) | One-off maintenance (geo backfill, QA verification) |

## Pipeline at a glance

```text
gateway  ──POST /internal/attack──►  this service
                                        ├─ write AttackEvent + upsert AttackerProfile
                                        ├─ geo-locate the IP
                                        └─ Socket.IO  emitLiveAlert  ──►  dashboard (sub-second)
```

The gateway (Sagiv/Bar) never connects to the malicious DB — only this service does.
See also [`ARCHITECTURE.md`](ARCHITECTURE.md) for the technical reference.
