# Packages

Shared libraries consumed by every app and service through the pnpm workspace. One
definition, used everywhere — so the gateway, telemetry, and admin panel stay in sync.

| Package | Owner(s) | What it provides |
|---------|----------|------------------|
| [`db-schemas/`](db-schemas/) | Sagiv + Max | Mongoose models, split by zone (admin, safezone, malicious) |
| [`shared-constants/`](shared-constants/) | All | `TRAP_TYPES` enum |
| [`shared-utils/`](shared-utils/) | Sagiv + Max | `getAttackerIp`, `fingerprint`, `startupLog` |

Open each package folder for details.
