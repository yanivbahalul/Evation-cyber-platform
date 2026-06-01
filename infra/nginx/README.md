# Nginx

> **Owner:** Sagiv Levy · **Mission 1.1**

`nginx.conf` is the edge reverse proxy and the only public entry point.

| Incoming path | Routed to |
|---------------|-----------|
| `/gateway/*` | `innotech-gateway` (`:4001`) |
| `/socket.io/*` | `logging-data-extraction` (`:3002`) |
| `/` | `admin-panel` (`:3000`) |

Also handles **SSL/TLS termination** and injects `X-Forwarded-For` / `X-Real-IP` so the
backends see the attacker's true origin.
