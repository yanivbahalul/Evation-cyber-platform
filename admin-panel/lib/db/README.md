# DB Library (Admin Reads)

> **Owner:** Yaniv (read paths) · schemas owned by Sagiv & Max

Database access used by the admin API routes.

| File | Purpose |
|------|---------|
| `maliciousDb.js` | Reads attack data for the dashboard APIs |

Safezone connections are added as needed for admin-user management.

> **Rule:** writes to the malicious DB go through the telemetry service (Max), **not** the
> admin panel. This layer is read-mostly.
