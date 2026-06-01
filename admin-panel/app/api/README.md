# API Routes

> **Owner:** Yaniv · **Mission 4.1** — Secure administrative API

Next.js App Router handlers. Everything under [`admin/`](admin/) requires a valid admin JWT
(HttpOnly cookie); the portal route is the one public bridge.

| Route group | Purpose |
|-------------|---------|
| [`admin/dashboard/`](admin/dashboard/) | Aggregate data bundle for the monitor |
| [`admin/stats/`](admin/stats/) | Live counters |
| [`admin/events/`](admin/events/) | Paginated attack events |
| [`admin/attackers/`](admin/attackers/) | Attacker profiles + per-IP timeline |
| [`admin/ban/`](admin/ban/) | List / ban / unban IPs |
| [`admin/honeytokens/`](admin/honeytokens/) | Honey token management |
| [`admin/users/`](admin/users/) | Admin user management + 2FA reset |
| [`admin/2fa/`](admin/2fa/) | 2FA enrollment |
| [`admin/register/`](admin/register/) | Admin signup + OTP verification |
| [`admin/logout/`](admin/logout/) · [`admin/exchange/`](admin/exchange/) | Session lifecycle |
| [`portal/session/`](portal/session/) | Gateway role/session bridge |

See each subfolder's `README.md` for the exact methods.
