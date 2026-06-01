# Services

The two Node.js backends that power the honeypot. The admin panel (`../admin-panel`) sits in front of them.

| Service | Port | Owner(s) | Role |
|---------|------|----------|------|
| [`innotech-gateway/`](innotech-gateway/) | `4001` | Sagiv + Bar | HR portal, Gatekeeper, and all traps |
| [`logging-data-extraction/`](logging-data-extraction/) | `3002` | Max | Telemetry, malicious DB, live alerts |

## How a request flows

```text
Browser
   │
   ▼
admin-panel (:3000)  ──proxy /gateway/*──►  innotech-gateway (:4001)
                                                  │  attack detected
                                                  ▼  POST /internal/attack
                                          logging-data-extraction (:3002)
                                                  │
                                   ┌──────────────┴──────────────┐
                                   ▼                             ▼
                          Malicious MongoDB            Socket.IO  ──►  dashboard (live)
```

The gateway **never** writes to the malicious database — it only reports over HTTP, and the telemetry service owns every write and broadcast.

See each service folder's `README.md` for details.
