# `/api/admin/ban`

> **Owner:** Yaniv

Manage banned IPs. Bans are synced to the telemetry `banned-ips` set so the gateway
Gatekeeper (Sagiv) enforces them.

| Method | Purpose |
|--------|---------|
| `GET` | List current bans |
| `POST` | Ban an IP |
| `DELETE` | Remove a ban |
