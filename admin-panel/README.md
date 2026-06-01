# Admin Panel

> **Owner:** Yaniv · **Mission 4** — Admin Dashboard, API & Security
> **Stack:** Next.js (App Router) · **Port:** `3000`

The Blue Team interface and the public entry point for the whole platform. It serves the
live attack monitor, the investigation timeline, and the secure admin APIs — and proxies
`/gateway/*` to the honeypot gateway.

## Folder map

| Folder | What's inside |
|--------|---------------|
| [`app/`](app/) | Routes and API handlers (App Router) |
| [`features/`](features/) | React UI: `auth`, `dashboard`, `investigation` |
| [`lib/`](lib/) | Auth (JWT/TOTP), DB connections, server helpers |
| [`public/`](public/) | Static assets |
| [`scripts/`](scripts/) | Dev helpers (public host, query benchmarks) |
| [`styles/`](styles/) | Global CSS (teal/orange security palette) |

## How it connects to the rest of the stack

- **Sagiv** — gateway HR pages are proxied through this app at `/gateway/*`.
- **Max** — Socket.IO `liveAlert` events are consumed here and rendered in real time.
- **Bar** — trap events surface on the dashboard once telemetry reports them.

Dashboard URLs are protected at the edge by `middleware.ts` +
[`lib/auth/portalAccessEdge.ts`](lib/auth).
