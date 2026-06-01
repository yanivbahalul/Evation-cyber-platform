# Gateway Services (Business Logic)

> **Owner:** Sagiv Levy

Reusable logic shared by the real and decoy controllers.

| File | Purpose |
|------|---------|
| `detectionService.js` | Pattern lists for SQLi, XSS, scanners, and path traversal — the heart of deep packet inspection |
| `banService.js` | IP-ban checks; syncs with the telemetry `banned-ips` API (Max) |

The Gatekeeper ([`../middleware`](../middleware)) imports `detectionService` to inspect every
request (Mission 1.2).
