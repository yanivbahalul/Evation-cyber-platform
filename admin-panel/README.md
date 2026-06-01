## ADMIN PANEL

Owner: Yaniv (Mission 4 — Admin Dashboard, API and Security)

What this folder is:
  Next.js app on port 3000. Proxies /gateway/* to the honeypot gateway.
  Blue Team attack monitor, investigation timeline, admin REST APIs, JWT and TOTP.

Subfolders:
  app/         Routes and API handlers
  features/    React UI (auth, dashboard, investigation)
  lib/         Auth, DB connections, server helpers
  public/      Static assets
  scripts/     Dev helpers (public host, query benchmarks)
  styles/      Global CSS

Related students:
  Max — Socket.IO live alerts consumed here
  Sagiv — Gateway HR pages are proxied through this app
  Bar — Trap events appear on dashboard after Max's telemetry
