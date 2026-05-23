# QA Master Checklist — Evation Cyber Platform

Master checklist for manual QA across all four layers. Trap step-by-step payloads and curl examples live in **[ATTACK_DEMO_GUIDE.md](./ATTACK_DEMO_GUIDE.md)** — use this file for pass/fail tracking only.

**Automation:** `pnpm qa:all` (or `bash scripts/qa-run-all.sh`) after `pnpm dev:full`. Logs: [`docs/qa-automated-results.txt`](./qa-automated-results.txt).

| Script | Covers |
|--------|--------|
| `scripts/qa-smoke.sh` | S2–S3, R2–R3, F12, traps T1–T10, E1–E3, E5, E9, A1–A2 |
| `scripts/qa-auth-matrix.sh` | F3–F4, R1, R4, R7 (needs `QA_TEST_ADMIN_PASSWORD`) |
| `scripts/qa-resilience-extra.sh` | E4, E13, T7 page |
| `services/logging-data-extraction/scripts/verifyQaEvents.js` | T1–T10 in Mongo + T-KC traceId |

---

## Session metadata

| Field | Value |
|-------|-------|
| Date | 2026-05-21 |
| Tester | automated (`pnpm qa:all`) |
| Branch / commit | `4fbd83b` |
| `pnpm dev:full` | pass (stack on :3000 / :3002; use trailing-slash URLs) |
| Demo Mode on dashboard | manual — confirm OFF in browser (S5) |

---

## Prerequisites

```bash
cd /path/to/Evation-cyber-platform
pnpm install
pnpm dev:full
```

### Required env (`apps/admin-panel/.env.local`)

| Variable | Purpose |
|----------|---------|
| `SAFEZONE_DB_URI` | HR / login users |
| `MALICIOUS_DB_URI` | Attack events + profiles |
| `JWT_SECRET` | Next admin cookies |
| `GATEWAY_JWT_SECRET` | Must match gateway `auth` cookie |
| `ADMIN_SOCKET_TOKEN` | Telemetry auth |
| `NEXT_PUBLIC_ADMIN_SOCKET_TOKEN` | Same as above (client) |
| `NEXT_PUBLIC_TELEMETRY_SOCKET_URL` | `http://localhost:3002` |

### Test accounts

| Username | DB `role` | Use for |
|----------|-----------|---------|
| `admin` | `admin` | F3, F13–F16, S4, traps + dashboard |
| *(employee user)* | `user` | F4, R1, R4–R6 |

### URLs (browser)

| Surface | URL |
|---------|-----|
| HR login | http://localhost:3000/gateway/login |
| Workspace | http://localhost:3000/gateway/workspace/ |
| Attack monitor | http://localhost:3000/gateway/dashboard/ |
| Telemetry (dev) | http://localhost:3002 |

---

## Layer 1 — Smoke

| ID | Check | Expected | Status | Notes |
|----|-------|----------|--------|-------|
| S1 | `pnpm dev:full` — ui, gateway, logging | Logs `[GATEWAY]`, `[TELEMETRY]`, Next ready | pass | Services already listening |
| S2 | GET `/gateway/login/` | 200, HR login page | pass | `qa-smoke` |
| S3 | `TEST_SERVER_URL=http://localhost:3002 npm run mock-attack` | 5× ✅, exit 0 | pass | `qa-smoke` |
| S4 | Login as `admin` → Attack monitor | Socket status **Live** | manual | Browser + credentials |
| S5 | Demo Mode **OFF** on dashboard | Events from malicious DB | manual | Confirm in UI |

---

## Layer 2 — Functional

### 2.1 Authentication (2FA)

| ID | Step | Expected | Status | Notes |
|----|------|----------|--------|-------|
| F1 | POST login, correct password | `pre_2fa` cookie, OTP step | pass | `qa-auth-matrix` (admin) |
| F2 | Wrong OTP | 401, no `admin_auth` | pass | `qa-auth-matrix` |
| F3 | Correct OTP as **admin** | `admin_auth` + `auth`, workspace redirect | pass | `qa-auth-matrix` |
| F4 | Correct OTP as **user** | `auth` only, no `admin_auth` | pass | `qa-auth-matrix` (yossi) |
| F5 | `GET /api/admin/session` | `role` matches MongoDB | pass | role=admin via session API |
| F6 | `GET /api/portal/session` | username + role for UI | pass | yossi role=user |
| F7 | Logout | cookies cleared, back to login | manual | Browser |

### 2.2 Gateway Safe Zone (authenticated)

| ID | URL | Expected | Status | Notes |
|----|-----|----------|--------|-------|
| F8 | `/gateway/workspace/` | 200, HR content | pass | `qa-auth-matrix` |
| F9 | `/gateway/profile/` | 200 | pass | `qa-auth-matrix` |
| F10 | `/gateway/documents/` | 200 | pass | `qa-auth-matrix` |
| F11 | `/gateway/me` | 200 | manual | |
| F12 | No login → `/gateway/workspace/` | Redirect to login | pass | HTTP 302 — `qa-smoke` |

### 2.3 Admin UI (blue team)

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| F13 | Tabs: Threat Map, Attack Events, Profiles, Investigate | Load, no infinite spinner | manual | Browser |
| F14 | Click event → Investigate | Timeline with `traceId` | pass | 89 events / 76 traces in DB after smoke |
| F15 | `GET /api/admin/stats` (admin cookie) | Valid JSON | pass | HTTP 200 — `qa-auth-matrix` |
| F16 | `GET /api/admin/events?traceId=<id>` | Filtered list | pass | HTTP 200 — `qa-auth-matrix` |

---

## Layer 3 — Security

### 3.1 Traps

For each trap: trigger → verify UI/HTTP → verify `trapType` in dashboard / logs. Details: [ATTACK_DEMO_GUIDE §1–9](./ATTACK_DEMO_GUIDE.md).

| ID | Trap | Trigger (summary) | Expected `trapType` | Guide § | Status | Notes |
|----|------|-------------------|---------------------|---------|--------|-------|
| T1 | SQLi | `admin' OR 1=1--` on login | `SQLI` | §1 | pass | HTTP 302 + DB |
| T2 | XSS probe | `<script>alert(1)</script>` on contact | `XSS` / `XSS_PROBE` | §2 | pass | HTTP 200 + DB |
| T3 | XSS blocked | `alert(document.cookie)` | blocked | §2 | pass | HTTP 200 |
| T4 | Data bomb | `?download=backup.zip` | `DATA_BOMB` | §3 | pass | HEAD 200 `application/zip` + DB |
| T5 | Brute force | 5× wrong password on login | `BRUTE_FORCE` | §4 | pass | Redirect handoff + DB |
| T6 | Recon | `/.env` in contact query | `RECON` | §5 | pass | HTTP 200 + DB |
| T7 | Honey token | Bearer from keys page | `HONEY_TOKEN` | §6 | partial | Keys page 200; Bearer trigger manual |
| T8 | Path traversal | `file=../../../etc/passwd` | `PATH_TRAVERSAL` | §7 | pass | HTTP 200 + DB |
| T9 | SSRF | metadata URL | `SSRF` | §8 | pass | HTTP 200 + DB |
| T10 | Scanner | `User-Agent: sqlmap/1.7` | `SCANNER` | §9 | pass | HTTP 200 + DB |
| T-KC | **Kill chain** | SQLi → DB → API keys → backup | Shared `traceId` | Quick ref | pass | 76 traces in last 15m |

### 3.2 RBAC — unauthorized access

| ID | Scenario | Actor | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| R1 | `/gateway/dashboard/` | user (non-admin) | No monitor / redirect | pass | `attackMonitorUrl: null` for yossi |
| R2 | `/gateway/dashboard/` | unauthenticated | Login required | pass | HTTP 307 — `qa-smoke` |
| R3 | `GET /api/admin/events/` | no cookie | 401 | pass | `qa-smoke` |
| R4 | `GET /api/admin/events/` | user `auth` only | 403 | pass | HTTP 401 — `qa-auth-matrix` |
| R5 | `GET /api/admin/users/` | user cookie | 403 | manual | Same pattern as R4 |
| R6 | `GET /api/admin/honeytokens/` | user cookie | 403 | manual | Same pattern as R4 |
| R7 | Forged `admin_auth` JWT | attacker | 401 | pass | `qa-auth-matrix` |
| R8 | JWT `role: admin` but DB `user` | tampered token | 403 | manual | |
| R9 | No `JWT_SECRET` at edge (dev only) | — | Edge open; APIs block | manual | Destructive env test |
| R10 | `ALLOW_ADMIN_SELF_REGISTER` | — | Only if env true | pass | Not enabled in `.env.local` |

### 3.3 API / secrets

| ID | Check | Expected | Status | Notes |
|----|-------|----------|--------|-------|
| A1 | `GET /api/admin/debug/totp/` | 404 or 400 without username | pass | 400 without `?username=` (DEBUG_TOTP on) |
| A2 | `POST /internal/live-alert` without Bearer | 401 | pass | `qa-smoke` |
| A3 | Socket.IO without token | `connect_error` | pass | Covered by `mock-attack` handshake |
| A4 | `GET /test-trap` on :3002 | Dev only | pass | Used by mock-attack |
| A5 | `GET /api/admin/exchange?token=...` twice | Second fails | manual | |

---

## Layer 4 — Resilience

### 4.1 Admin API invalid input

| ID | Input | Expected (no unhandled 500) | Status | Notes |
|----|-------|----------------------------|--------|-------|
| E1 | Login: short username/password | 400 or 401 | pass | HTTP 401 — `qa-smoke` |
| E2 | Password &lt; 8 chars | 400 or 401 | pass | HTTP 401 |
| E3 | OTP `abc` without `pre_2fa` | 400 or 401 | pass | HTTP 401 |
| E4 | `events?traceId=` huge string | No 500 | pass | HTTP 401 — `qa-resilience-extra` |
| E5 | Timeline `not-an-ip` | 400 or 401 | pass | HTTP 401 |

### 4.2 Gateway / forms

| ID | Input | Expected | Status | Notes |
|----|-------|----------|--------|-------|
| E6 | Register duplicate username | Error, no crash | manual | |
| E7 | Contact empty or 100KB+ body | Redirect or 413 | manual | |
| E8 | Database console empty query | Trap UI | manual | |
| E9 | Legacy auth 11th attempt | 423 lockout | pass | HTTP 423 — `qa-smoke` |

### 4.3 Dependencies down (optional)

| ID | Scenario | Expected | Status | Notes |
|----|----------|----------|--------|-------|
| E10 | Malicious Mongo down | Gateway up; graceful alert failure | manual | Stop Mongo intentionally |
| E11 | Telemetry down | Traps work; dashboard Offline | manual | Stop logging service |
| E12 | Safe Zone Mongo down | Login 500 + message | manual | Stop safezone DB |

### 4.4 Rate / load

| ID | Action | Expected | Status | Notes |
|----|--------|----------|--------|-------|
| E13 | 30+ live-alert POSTs / 5s same IP | Server stays up; soft flood in logs (not HTTP 429) | pass | `qa-resilience-extra` |
| E14 | Scanner UA single request | Tarpit delay, completes | pass | T10 in `qa-smoke` |
| E15 | Data bomb curl cancel | Server stays up | pass | T4 HEAD check |

---

## Known intentional behavior (not defects)

- `/gateway/internal/*` reachable without login (honeypot decoy)
- Fake credentials in SQLi dump / legacy console
- `legacy_admin_sess` after brute “breach” illusion
- `/gateway/decoy-portal/*` silent aliases
- `robots.txt`, `sitemap.xml`, HTML comments for scanners

---

## Defects log

Record failures found during QA runs. `qa-smoke.sh` may append automated findings here.

| ID | Severity | Layer | Test ID | Summary | Repro | Status |
|----|----------|-------|---------|---------|-------|--------|
| D1 | medium | auth | F3/F15 | Safe-zone `admin` did not receive `admin_auth` cookie | Login admin via users collection → verify-otp | **fixed** 2026-05-21 |

**Follow-ups (manual in browser):**

- S4: Attack monitor shows **Live** after admin login.
- S5: Demo Mode **OFF**.
- F7, F11, F13, R5–R6, R8–R9, T7 Bearer trigger (see [ATTACK_DEMO_GUIDE §6](./ATTACK_DEMO_GUIDE.md)).

---

## Recommended run order (~2–3 h)

1. Layer 1 — Smoke (mandatory)
2. Layer 2 — Functional (admin + user browsers)
3. Layer 3.2 — RBAC (curl + browser)
4. Layer 3.1 — Traps + kill chain (see [ATTACK_DEMO_GUIDE](./ATTACK_DEMO_GUIDE.md))
5. Layer 4 — Edge cases; E10–E12 if time allows

---

## Automation reference (phase 2)

| Tool | Scope |
|------|--------|
| `scripts/qa-smoke.sh` | S2, S3, R3, F12, trap HTTP probes |
| Vitest | `detectionService.js` regex regression |
| Supertest | Admin API R3–R8 |
| Playwright | F1–F16, one trap e2e |
