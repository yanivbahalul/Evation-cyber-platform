# InnoTech monorepo

Next admin (`apps/adminpannel`), Express gateway (`services/innotech-gateway`), telemetry + Socket.IO (`services/logging-data-extraction`).

## Quick start

**Stack:** Node LTS, **pnpm 11** (see root `package.json` → `packageManager`).

```bash
pnpm install
pnpm dev:full
```

**`pnpm dev:full`** (use this by default) runs admin **:3000**, gateway **:4001**, and telemetry **:3002** with `dotenv-cli` loading **`apps/adminpannel/.env.local`** — so the admin UI can show **Socket live** without a second terminal.

**Other commands:** `pnpm dev:all` = admin + gateway only (socket stays offline unless you also run `pnpm dev:logging`). `pnpm dev:ui` / `pnpm dev:gateway` / `pnpm dev:logging` = one service each. `pnpm dev` = every workspace `dev` script in parallel (env differs from `dev:full`).

## Env file

Add **`apps/adminpannel/.env.local`** (gitignored). Next reads it; **`testServer.js`** also merges it in local dev when present.

**Must have:** `MALICIOUS_DB_URI`, `SAFEZONE_DB_URI`, auth secrets (`JWT_SECRET`, `GATEWAY_JWT_SECRET`, `ADMIN_TOTP_ENC_KEY_BASE64`, etc.).

**Socket:** `NEXT_PUBLIC_TELEMETRY_SOCKET_URL` = full URL (e.g. `http://localhost:3002`, not bare `localhost`). `NEXT_PUBLIC_ADMIN_SOCKET_TOKEN` must match **`ADMIN_SOCKET_TOKEN`**. `ADMIN_DASHBOARD_ORIGINS` = comma-separated origins (e.g. `http://localhost:3000`); in non-production, empty origins fall back to permissive local CORS in `SocketService`. After any **`NEXT_PUBLIC_*`** change, restart Next.

## Socket badge in the UI

**Live** = browser connected to telemetry. **Offline** = telemetry not running, bad URL/port, token mismatch, or CORS — in dev, check the console for **`[admin socket] connect_error`**. Historical data can still load over REST; the socket is for **push** `liveAlert` events.

## Production

Set **`NODE_ENV=production`**, set **`ADMIN_DASHBOARD_ORIGINS`** to real admin origins (no dev CORS fallback), and **`NEXT_PUBLIC_TELEMETRY_SOCKET_URL`** to a URL the **browser** can reach (correct scheme/host/TLS).

## pnpm from root

Use `pnpm --dir apps/adminpannel <cmd>` (or `services/...`) instead of `cd` when you only need one package.
