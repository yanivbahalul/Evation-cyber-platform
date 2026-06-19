# `/api/admin/maintenance`

> **Owner:** Yaniv

Destructive maintenance on the **malicious telemetry DB** (attack events, profiles, honey tokens).
Requires admin JWT and a typed confirmation phrase per action.

| Method | Purpose |
|--------|---------|
| `GET` | Collection counts for the maintenance panel |
| `POST` | Run a maintenance action (`action` + `confirm`) |

## POST body

```json
{ "action": "events", "confirm": "CLEAR EVENTS" }
```

| `action` | `confirm` phrase | Effect |
|----------|------------------|--------|
| `events` | `CLEAR EVENTS` | Delete all `attack_events` |
| `profiles` | `CLEAR PROFILES` | Delete all attacker profiles (includes ban flags) |
| `honeytokens` | `RESET TOKENS` | Clear `isTriggered` and `triggeredLogs` on all honey tokens |
| `honeytokens_delete` | `DELETE TOKENS` | Delete all honey token records |
| `all` | `WIPE ALL` | Delete events, profiles, and honey tokens |

Does **not** modify the Safezone DB (employees / admin users).
