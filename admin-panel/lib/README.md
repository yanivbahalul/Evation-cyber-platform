# Lib (shared admin-panel code)

**Owner:** Yaniv

## What is here

| Folder | Contents |
|--------|----------|
| `auth/` | JWT (edge + node), TOTP, portal access, cookies, `requireAdmin` |
| `db/` | Connections to safezone and malicious DB for admin reads |
| `security/` | TOTP secret encryption |
| `server/` | `fetchDashboardData`, `telemetryDb`, `adminDb` helpers |
| `types/` | TypeScript types for API payloads |

**Mission 4.1:** HttpOnly JWT cookies, 2FA enrollment, protected `/admin/*` APIs.

Schemas come from `packages/db-schemas` (Sagiv = admin/safezone, Max = malicious).
