# Docker

> **Owner:** Sagiv Levy

Dockerfiles and entry scripts for each service, used by
[`../docker-compose.yml`](../docker-compose.yml).

| File | Purpose |
|------|---------|
| `Dockerfile.gateway` | Builds the InnoTech gateway image |
| `Dockerfile.telemetry` | Builds the telemetry service image |
| `Dockerfile.admin-panel` | Builds the Next.js admin panel image |
| `start-gateway.sh`, `start-ngrok.sh`, … | Container entrypoints |
