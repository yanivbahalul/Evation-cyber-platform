APP (Next.js routes)
Owner: Yaniv

What is here:
  Page routes and API route handlers for the admin panel.

  app/gateway/dashboard/  Attack monitor (Live socket, stats, map)
  app/login/              Admin login
  app/register/           Admin registration + 2FA enroll
  app/admin/map/          Protected alias → dashboard map tab
  app/admin/ban/          Protected alias → ban management tab
  app/ops/                Internal ops pages
  app/api/admin/*         REST: dashboard, stats, ban, honeytokens, users, 2FA
  app/api/portal/session/ Portal session for gateway role checks

Middleware at admin-panel/middleware.ts protects dashboard URLs on the edge.
