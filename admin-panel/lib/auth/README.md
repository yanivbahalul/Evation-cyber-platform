# Auth Library

> **Owner:** Yaniv · **Mission 4.1** — Authentication, JWT & 2FA

Everything that proves who a user is and gates access to the dashboard.

| File | Purpose |
|------|---------|
| `jwt.ts` / `jwtEdge.ts` | Sign & verify JWTs (Node runtime and Edge middleware) |
| `totp.ts` | Time-based one-time passwords for 2FA |
| `portalAccess.ts` / `portalAccessEdge.ts` | Role/permission checks for protected routes |
| `requireAuth.ts` / `requireAdmin.ts` | Guards for API routes |
| `cookiePolicy.ts` | HttpOnly + Secure cookie settings |
| `gatewayJwt.ts` | Token bridge to the gateway session |

Tokens are stored in **HttpOnly, Secure cookies** so XSS can't steal them; the Edge
middleware validates dashboard access before a page loads.
