## INFRASTRUCTURE

Owner: Sagiv Levy (Mission 1.1 — Cloud network and reverse proxy)

What is here:
  docker-compose.yml  Local stack: nginx, gateway, telemetry, admin, Mongo, ngrok
  .env.example        Template for URIs, JWT, socket tokens, PUBLIC_HOST
  docker/             Dockerfiles and start scripts per service
  nginx/              Edge routing, SSL termination, X-Forwarded-For injection
  terraform/          AWS VPC, ALB, ECS, ECR for production deploy

Nginx binds 80/443 (or 3000 in compose), forwards to gateway and admin-panel.
Preserves attacker IP via X-Forwarded-For and X-Real-IP for getAttackerIp.js.
