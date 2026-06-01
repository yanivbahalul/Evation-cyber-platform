# Infrastructure

> **Owner:** Sagiv Levy · **Mission 1.1** — Cloud network & reverse proxy

Everything needed to run the stack locally or deploy it to AWS.

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Local stack: nginx, gateway, telemetry, admin panel, Mongo, ngrok |
| `.env.example` | Template for DB URIs, JWT secrets, socket tokens, `PUBLIC_HOST` |
| [`docker/`](docker/) | Dockerfiles and start scripts per service |
| [`nginx/`](nginx/) | Edge routing, TLS termination, header injection |
| [`terraform/`](terraform/) | AWS VPC, ALB, ECS, ECR for production |

## Reverse proxy

Nginx is the single public entry point. It terminates SSL, forwards traffic to the
backends, and preserves the attacker's real IP via `X-Forwarded-For` / `X-Real-IP` so that
[`getAttackerIp.js`](../packages/shared-utils) can read it downstream.

```bash
cd infra
docker compose up --build   # serves the whole stack on http://localhost:3000
```
