# DB Schemas

Mongoose models for all three data zones, organized by owner. The folders are kept
separate to enforce the **air-gap** between legitimate and attacker data.

| Folder | Owner | Database | Models |
|--------|-------|----------|--------|
| [`admin/`](admin/) | Sagiv | safezone | `AdminUser` |
| [`safezone/`](safezone/) | Sagiv | safezone | `RealEmployee`, `SafezoneUser` |
| [`malicious/`](malicious/) | Max | malicious | `AttackerProfile`, `AttackEvent`, `HoneyToken` |
| `connect.js` | — | — | Connection factory (safezone vs malicious pools) |

**Mission 3.3:** the malicious models use `mongoose.createConnection()` — a separate pool
from the safezone, so the two databases never share a connection.

Yaniv reads malicious data via the admin panel and telemetry but does not own the schemas.
