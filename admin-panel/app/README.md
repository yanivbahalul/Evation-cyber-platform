# App (Next.js App Router)

> **Owner:** Yaniv

Page routes and API route handlers for the admin panel.

## Pages

| Route | Purpose |
|-------|---------|
| [`gateway/dashboard/`](gateway/dashboard/) | Attack monitor — live socket, stats, map |
| [`login/`](login/) | Admin login |
| [`register/`](register/) | Admin registration + 2FA enrollment |
| [`admin/map/`](admin/map/) | Protected alias → dashboard map tab |
| [`admin/ban/`](admin/ban/) | Protected alias → ban management tab |
| [`ops/`](ops/) | Internal ops pages |

## API

| Route | Purpose |
|-------|---------|
| [`api/admin/*`](api/admin/) | Secure REST: dashboard, stats, ban, honeytokens, users, 2FA, … |
| [`api/portal/session/`](api/portal/session/) | Portal session for gateway role checks |

`middleware.ts` (one level up) protects the dashboard URLs at the edge.
