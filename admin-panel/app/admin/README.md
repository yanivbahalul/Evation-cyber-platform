# Protected Admin Aliases

> **Owner:** Yaniv

Short, memorable URLs that redirect into dashboard tabs.

| Route | Goes to |
|-------|---------|
| [`map/`](map/) | Dashboard map tab |
| [`ban/`](ban/) | Ban management tab |

Both are protected by `middleware.ts` and [`portalAccessEdge`](../../lib/auth).
