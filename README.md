# InnoTech monorepo

Monorepo for the Evation cyber platform: **Next.js admin**, **Express gateway**, and **telemetry** (REST + Socket.IO).

| Package | Path | Default port |
| --- | --- | --- |
| Admin UI | `apps/adminpannel` | 3000 |
| Gateway | `services/innotech-gateway` | 4001 |
| Telemetry | `services/logging-data-extraction` | 3002 |

---

## Prerequisites

- **Node.js** (LTS recommended)
- **pnpm 11** — version is pinned in root `package.json` (`packageManager`)

---

## Environment setup

Create a single env file used by the root dev scripts and Next.js:

**File:** `apps/adminpannel/.env.local`  
This path is **gitignored**. Do not commit secrets.

| Area | Variables |
| --- | --- |
| Databases | `MALICIOUS_DB_URI`, `SAFEZONE_DB_URI` |
| Auth / crypto | `JWT_SECRET`, `GATEWAY_JWT_SECRET`, `ADMIN_TOTP_ENC_KEY_BASE64`, and related secrets your app expects |
| Live socket (admin ↔ telemetry) | See below |

### Socket / CORS (local dev)

Set these so the admin dashboard can connect to telemetry:

1. **`NEXT_PUBLIC_TELEMETRY_SOCKET_URL`** — full URL the **browser** calls (e.g. `http://localhost:3002`). Use a URL, not a bare hostname.
2. **`NEXT_PUBLIC_ADMIN_SOCKET_TOKEN`** — must match **`ADMIN_SOCKET_TOKEN`** on the telemetry service.
3. **`ADMIN_DASHBOARD_ORIGINS`** — comma-separated allowed origins (e.g. `http://localhost:3000`). In development, empty origins may fall back to permissive local CORS in `SocketService`.

After changing any **`NEXT_PUBLIC_*`** variable, restart the Next.js dev server.

The telemetry **`testServer.js`** also picks up values from `apps/adminpannel/.env.local` when it exists, so one file can drive local dev.

---

## Quick start

From the repository root:

```bash
pnpm install
pnpm dev:full
```

**`pnpm dev:full`** is the default for full-stack local work: it loads `apps/adminpannel/.env.local` via `dotenv-cli`, then runs admin, gateway, and telemetry together so the UI can show a **live** socket without extra terminals.

---

## npm scripts (root)

| Script | What it runs |
| --- | --- |
| `pnpm dev:full` | Admin + gateway + telemetry (socket-friendly; uses `.env.local`) |
| `pnpm dev:all` | Admin + gateway only (start `pnpm dev:logging` separately if you need the socket) |
| `pnpm dev:ui` | Admin only |
| `pnpm dev:gateway` | Gateway only |
| `pnpm dev:logging` | Telemetry only |
| `pnpm dev` | Every workspace `dev` script in parallel — env loading differs from `dev:full` |

---

## Socket status in the UI

- **Live** — browser is connected to telemetry over the socket.
- **Offline** — telemetry not running, wrong URL/port, token mismatch, or CORS. In dev, open the browser console and look for **`[admin socket] connect_error`**.

Historical data may still load over REST; the socket is for **push** events such as `liveAlert`.

---

## Production

- Set **`NODE_ENV=production`**
- Set **`ADMIN_DASHBOARD_ORIGINS`** to real admin origins (no dev CORS shortcut)
- Set **`NEXT_PUBLIC_TELEMETRY_SOCKET_URL`** to a URL the browser can reach (correct scheme, host, and TLS)

---

## Project docs

Deliverables (requirements, design, diagrams) live in **`docs/`**.

---

## Tip: run commands in one package

Without changing directory:

```bash
pnpm --dir apps/adminpannel <command>
pnpm --dir services/innotech-gateway <command>
pnpm --dir services/logging-data-extraction <command>
```
