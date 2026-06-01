# Lib (Shared Admin-Panel Code)

> **Owner:** Yaniv

Non-UI building blocks shared across pages and API routes.

| Folder | What's inside |
|--------|---------------|
| [`auth/`](auth/) | JWT (edge + node), TOTP, portal access, cookies, `requireAdmin` |
| [`db/`](db/) | Connections to the safezone and malicious DBs for admin reads |
| [`security/`](security/) | TOTP secret encryption |
| [`server/`](server/) | `fetchDashboardData`, `telemetryDb`, `adminDb` helpers |
| [`types/`](types/) | TypeScript types for API payloads |

**Mission 4.1:** HttpOnly JWT cookies, 2FA enrollment, and protected `/admin/*` APIs.

Schemas come from [`../../packages/db-schemas`](../../packages/db-schemas) (Sagiv =
admin/safezone, Max = malicious).
