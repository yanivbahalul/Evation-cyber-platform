# HoneyShield — Video Narration Scripts

Technical presentation scripts for the HoneyShield demo video. Each part includes **Visual** (what to show on screen) and **Audio** (English narration).

**Base URL:** `http://localhost:3000/gateway/`  
**Attack Monitor:** `http://localhost:3000/gateway/dashboard/`  
**Before recording:** `docker compose logs -f gateway telemetry` (from `infra/`) · Demo Mode **OFF** on dashboard.

---

## Timing overview

| Part | Topic | Time |
|------|-------|------|
| 1 | Project Overview | 0:00 – 1:00 |
| 2 | Code Walkthrough — Gatekeeper Middleware | 1:00 – 2:00 |
| 3 | SQL Injection — Detection & Deception Chain | 2:00 – 4:30 |
| 4 | Cross-Site Scripting — Tiered Sandbox | 4:30 – 6:30 |
| 5 | Brute Force — Psychological Breach Illusion | 6:30 – 8:30 |
| 6 | Honey Tokens — Planted Credentials & API Deception | 8:30 – 11:00 |
| 7 | Closing — Blue Team Summary & Conclusion | 11:00 – 12:30 |

**Total:** ~12–13 minutes

---

## Part 1: Project Overview (0:00 – 1:00)

### Visual

- Start with the presentation title slide showing the project name **"HoneyShield — Active Cyber Deception & Honeypot System"**.
- Transition to a high-resolution view of the system architecture diagram, highlighting the traffic flow from the Nginx reverse proxy to the Gatekeeper Middleware.

### Audio

"Welcome to the technical overview of HoneyShield, an active cyber deception and honeypot platform. This system is engineered to protect production infrastructure by identifying, profiling, and trapping malicious actors in real-time. Unlike traditional security tools that rely exclusively on blocking known threats, HoneyShield actively engages attackers using an invisible, multi-tiered deception environment. The architecture operates entirely transparently to the intruder, silently mutating and rerouting malicious traffic away from the legitimate application layer and into isolated traps. This strategy allows defense teams to exhaust attacker resources, trace structural patterns, and gather threat intelligence without alerting the adversary that their reconnaissance has been compromised. In this presentation, we will break down the underlying codebase and demonstrate these core defense mechanisms under active exploit scenarios."

---

## Part 2: Code Walkthrough — The Gatekeeper Middleware (1:00 – 2:00)

### Visual

- Screen recording of the IDE showing the project directory structure.
- Open the central middleware pipeline file (`services/innotech-gateway/middleware/gatekeeper.js`).
- Scroll deliberately through the request classification functions, regex arrays, and connection pool assignment blocks.

### Audio

"The core of the interception architecture is built on a Node.js and Express pipeline running behind an Nginx reverse proxy. Every incoming HTTP request must pass through the Gatekeeper Middleware before hitting any application route. First, the middleware executes an $O(1)$ IP-reputation lookup against an in-memory blacklist, followed by synchronous regular expression scanning to intercept SQL Injection and Cross-Site Scripting patterns. Clean requests are permitted to continue directly to the Safe Zone—the actual MVC application utilizing EJS, bcrypt, and MongoDB Atlas. However, when malicious signatures are triggered, the middleware executes a silent reroute via internal request URL mutation. All subsequent payloads from that IP are then dynamically bound to an isolated Mongoose connection pool."

---

## Part 3: SQL Injection — Detection & Deception Chain (2:00 – 4:30)

### Visual

- IDE: open `services/innotech-gateway/services/detectionService.js` — highlight `patterns.SQLI` and `patterns.AUTH_SQLI` (stricter profile for login forms).
- IDE: `services/innotech-gateway/middleware/decoyReroute.js` — SQLI block and `handoffSqliBypassLogin`.
- Browser: `http://localhost:3000/gateway/login` — enter `admin' OR 1=1--` + any password (8+ characters).
- Browser: green bypass page → **Open database console** → run `SELECT * FROM users` twice (dump then tarpit/error).
- Split screen: Attack Monitor — `SQLI` event + `sqli_bypass_illusion`.

### Audio

"SQL injection is intercepted at the Gatekeeper layer before any database driver is invoked. The detection engine in `detectionService.js` applies a prioritized regular-expression matrix against the full request surface — body fields, query parameters, URL path, and User-Agent. On authentication endpoints, a stricter `AUTH_SQLI` profile scans only the username and password fields, deliberately avoiding false positives on common password characters like hash signs or semicolons that appear during brute-force guessing.

When a SQLi signature fires on a login POST, the middleware does not return an error. Instead, `decoyReroute` executes a silent handoff: the attacker is redirected to a legacy administrator sign-in page displaying a green banner — 'Authentication bypass accepted.' This is the first layer of the deception narrative. The attacker believes their tautology payload defeated the authentication layer.

From there, the kill chain escalates to a fabricated database console at `/internal/services/database`. Critically, no SQL statement ever reaches MongoDB. The console is a pure EJS illusion. Each query execution is logged as a separate SQLi event and routed through an odd-even rotation per source IP: on odd attempts, the system renders a realistic credential dump table generated by Faker, complete with bcrypt-style hashes and planted honey-token rows. On even attempts, the tarpit module introduces a deliberate delay — between thirty and one hundred twenty seconds in production — followed by a randomized fake MySQL error such as 'too many connections' or 'table users is full.' This exhausts attacker time and tools like sqlmap while preserving the illusion of a live, overloaded database.

Watch the Attack Monitor: each step — bypass, query, dump or tarpit — generates a correlated telemetry event linked by the `attacker_trace_id` cookie, giving the Blue Team a complete structural map of the intrusion attempt without the adversary ever touching production data."

### Quick triggers

| Action | URL / payload |
|--------|---------------|
| Login bypass | POST `/gateway/login` · `username=admin' OR 1=1--` |
| Direct export | `/gateway/internal/services/database?export=credentials` |
| Terminal script | `scripts/yaniv-test/03-sqli-login.sh` |

---

## Part 4: Cross-Site Scripting — Tiered Sandbox (4:30 – 6:30)

### Visual

- IDE: `services/innotech-gateway/services/detectionService.js` — `patterns.XSS` (broad tripwire).
- IDE: `services/innotech-gateway/utils/xssPayloadClassifier.js` — probe vs blocked classification.
- Browser: `http://localhost:3000/gateway/contact` — submit message `<script>alert(1)</script>`.
- Browser: same form — `<script>alert(document.cookie)</script>`.
- Compare: alert dialog (probe) vs "Content sanitized" banner (blocked).
- Dashboard: `XSS_PROBE` with `xssTier: probe` vs payload prefixed `[BLOCKED]`.

### Audio

"Cross-Site Scripting detection operates as a two-stage pipeline. The Gatekeeper applies a broad XSS tripwire — matching script tags, javascript URIs, event handlers like onerror and onload, and alert calls — across any request field. Unlike SQLi, XSS does not redirect the attacker away from the contact form. Instead, `decoyReroute` immediately renders a tiered sandbox page styled as an IT support ticket confirmation.

The first tier is the probe sandbox. When the payload classifier in `xssPayloadClassifier.js` identifies a simple demonstration probe — such as `alert(1)` or an image tag with onerror — the sandbox reflects the payload live in an 'unmoderated preview queue.' In the browser, the alert dialog fires. This is intentional: it convinces the attacker the application is genuinely vulnerable, encouraging deeper exploitation attempts that we can observe and log.

The second tier is the blocked sandbox. Payloads that attempt cookie exfiltration, localStorage access, external script loading, eval execution, or encoding bypasses are quarantined. The page displays a 'Content sanitized' banner, and the payload appears only in an HTML-escaped preview block — no script execution occurs. The stored telemetry prefixes these events with `[BLOCKED]` and records the moderation rule that triggered quarantine.

From the attacker's perspective, both tiers look like a functioning support portal. From the defender's perspective, every XSS attempt — whether executed or blocked — is a structured intelligence event with tier classification, full payload capture, and real-time broadcast to the Attack Monitor via Socket.IO."

### Quick triggers

| Tier | URL / payload |
|------|---------------|
| Probe | `/gateway/contact?msg=<script>alert(1)</script>` |
| Blocked | `/gateway/contact?msg=<script>alert(document.cookie)</script>` |
| Terminal script | `scripts/yaniv-test/04-xss-probe.sh` · `05-xss-blocked.sh` |

---

## Part 5: Brute Force — Psychological Breach Illusion (6:30 – 8:30)

### Visual

- IDE: `services/innotech-gateway/utils/loginBruteTrap.js` — `pickThreshold()` (random 5–10), `shouldHandoffToDecoyLogin()`.
- IDE: `services/innotech-gateway/controllers/realController.js` — `failLogin` → redirect + `legacy_admin_sess` cookie.
- Browser: `http://localhost:3000/gateway/login` — username `admin`, wrong password, submit 5–6 times.
- Browser: redirect to `/internal/console?breach=legacy` with green **Authentication successful** banner.
- Optional: Legacy sign-in from sidebar — highlight 4s delay every 5th attempt (`traps/fakeLogin.js`).
- Dashboard: `BRUTE_FORCE` with `handoff: breach_illusion`.

### Audio

"Traditional brute-force defenses lock accounts or introduce CAPTCHAs — signals that tell the attacker they have been detected. HoneyShield inverts this model entirely. The `loginBruteTrap` module tracks failed authentication attempts per session using the `attacker_trace_id` cookie, with a randomized threshold between five and ten attempts. The threshold varies per attacker session so the trap cannot be gamed by counting attempts.

When the threshold is reached, the system does not block access. It congratulates the attacker. The `failLogin` handler establishes a fake administrator session via the `legacy_admin_sess` HTTP-only cookie and redirects to the Administrator Console with a green 'Authentication successful' banner. The attacker's username appears in the header as 'Signed in as admin.' Every sidebar link — database console, API keys, system backup — leads to additional deception traps.

This is psychological warfare applied to credential attacks. The adversary believes they have achieved a genuine breach through persistence. In reality, every failed attempt was logged, and the handoff moment is the highest-fidelity signal in the kill chain — it confirms intentional, sustained attack behavior mapped to MITRE technique T1110, Brute Force.

A secondary trap exists on the legacy sign-in endpoint for attackers who navigate there independently. Every fifth failed attempt introduces a four-second delay with a 'service under heavy load' message. On the tenth attempt, access is granted regardless of credentials — further reinforcing the illusion that the security perimeter has collapsed."

### Quick triggers

| Action | Details |
|--------|---------|
| Employee login | 5–10 failed POSTs to `/gateway/login` |
| Terminal script | `scripts/yaniv-test/09-brute-force.sh` |
| Expected telemetry | `BRUTE_FORCE` · `handoff: breach_illusion` |

---

## Part 6: Honey Tokens — Planted Credentials & API Deception (8:30 – 11:00)

### Visual

- IDE: `packages/shared-constants/honeyTokens.js` — fixed catalog (`hr-api-key`, `aws-backup-key`, `hr-db-uri`).
- IDE: `services/innotech-gateway/middleware/honeyTokenDetector.js` — scan `Authorization`, `X-API-Key`, query/body.
- Browser: visit `http://localhost:3000/gateway/.env` — show planted keys.
- Terminal/Browser: `Authorization: Bearer <HR_API_KEY>` → `GET /internal/api/v1/hr/export?page=1&limit=25`.
- Browser: JSON response with 247 fabricated employees.
- Dashboard: Honey Tokens panel — token flips from intact to triggered; leak source `backup_env`.
- Optional: 429 after 20 requests/min; 403 when JWT lacks required scope.

### Audio

"Honey tokens represent the deepest layer of the deception architecture — planted credentials designed to be discovered, exfiltrated, and reused. The fixed catalog in `honeyTokens.js` defines stable bait values across multiple leak surfaces: a production `.env` backup file, a committed `.git/config` with AWS credentials, and rows embedded in the SQLi credential dump. The same API key appears consistently in every artifact, so an attacker who chains reconnaissance, SQL injection, and file exposure will converge on identical bait.

Detection runs on every request through `honeyTokenDetector` middleware, which executes before the Gatekeeper. It extracts presented credentials from Authorization headers, X-API-Key headers, AWS access key fields, and query or body parameters. When a catalog match is found, `HONEY_TOKEN` becomes the primary trap type — it takes priority over all other detections, ensuring the most forensically valuable signal is preserved.

If the attacker calls a scoped fake API — such as the HR export endpoint — the system returns a paginated JSON response with two hundred forty-seven fabricated employee records. HTTP 200. Realistic schema. Zero real data. Usage is recorded in the malicious database with full forensic context: source IP, leak provenance, HTTP outcome, and trace ID. The Honey Tokens panel on the admin dashboard flips from intact to triggered in real time.

Rate limiting adds another deception layer: twenty requests per sixty-second window per token, with standard RateLimit headers. A 403 response fires when a valid JWT lacks the required scope. Every HTTP outcome — success, unauthorized, forbidden, or throttled — is logged as structured evidence. The attacker believes they have compromised an internal API. The defense team knows exactly which canary was touched, how it was discovered, and where the kill chain began."

### Quick triggers

| Step | Command |
|------|---------|
| Discover key | `curl http://localhost:3000/gateway/.env` |
| Trigger API | `curl -H "Authorization: Bearer <key>" "http://localhost:3000/gateway/internal/api/v1/hr/export?page=1&limit=25"` |
| Terminal script | `scripts/yaniv-test/10-honey-token.sh` |

---

## Part 7: Closing — Blue Team Summary & Conclusion (11:00 – 12:30)

### Visual

- Attack Monitor: `http://localhost:3000/gateway/dashboard/` — live map, event feed.
- Investigate tab: single `attacker_trace_id` timeline — SQLi → BRUTE_FORCE → HONEY_TOKEN.
- Terminal: `docker compose logs -f gateway telemetry` — `[GATEWAY]`, `[TRAP]`, `[ATTACK]` lines.
- Optional: return to architecture diagram from Part 1.
- Closing slide: **"HoneyShield — Active Cyber Deception & Honeypot System"**.

### Audio

"Let us step back and examine what just occurred from the defender's perspective. Every attack demonstrated in this session — SQL injection, cross-site scripting, brute force, and honey token reuse — was intercepted, classified, and rerouted before reaching the Safe Zone application layer. No MongoDB query was executed. No real credential was exposed. No production route was compromised.

The Attack Monitor received each event in real time via Socket.IO, enriched with geolocation, device fingerprint, and MITRE ATT&CK technique mapping. The Investigate view correlates all events under a single `attacker_trace_id`, reconstructing the attacker's structural pattern across the entire deception environment — from initial probe to credential exfiltration to API abuse.

This is the core thesis of HoneyShield: active cyber deception. Rather than relying exclusively on signature blocking and silent drops, the platform engages adversaries inside an isolated, transparently invisible trap environment. It exhausts their resources, captures their tooling signatures, and produces actionable threat intelligence — all while the legitimate InnoTech HR application continues operating undisturbed behind the Gatekeeper.

The codebase implements this through a modular pipeline: fingerprinting, honey token detection, regex-based Gatekeeper classification, and trap-specific routing via `decoyReroute`. Telemetry flows through an air-gapped logging service into a dedicated malicious database, completely separated from employee records. The admin dashboard provides the Blue Team with live situational awareness, attacker profiling, and kill-chain investigation — turning every intrusion attempt into defensive advantage.

Thank you for reviewing HoneyShield. The repository, architecture documentation, and automated trap demonstration scripts are available for hands-on evaluation. Questions are welcome."

---

## Recording checklist

Use one browser session (keeps `attacker_trace_id` cookie) for the full kill chain.

| Step | Demo | Script |
|------|------|--------|
| 1 | Log in as admin → open Attack Monitor (Live) | — |
| 2 | SQLi login bypass → database console ×2 | `03-sqli-login.sh` |
| 3 | XSS contact form (probe then blocked) | `04-xss-probe.sh` · `05-xss-blocked.sh` |
| 4 | Brute force 5–10 wrong logins | `09-brute-force.sh` |
| 5 | Honey token `.env` → Bearer HR export | `10-honey-token.sh` |
| 6 | Investigate timeline for trace ID | `run-kill-chain.sh` (full chain) |

**Automated full chain:** `pnpm trap:chain` (server must be running).

---

## Narration accuracy notes

| Topic | Note |
|-------|------|
| Brute force threshold | Randomized **5–10** per session — say "after several failed attempts" if you prefer not to cite the range. |
| Legacy login trap | Attempt **10 grants access** (not HTTP 423 lockout). |
| Honey tokens | Full secrets appear in **leak artifacts** (`.env`, SQLi dump) — integrations page shows **masked** keys only. |
| SQLi | No real SQL runs — dump/tarpit is EJS + Faker only. |
| Gatekeeper priority | `HONEY_TOKEN` wins over SQLi/XSS when a planted credential is presented. |

---

## Key source files

| Part | Files |
|------|-------|
| 2 | `middleware/gatekeeper.js` |
| 3 | `services/detectionService.js`, `middleware/decoyReroute.js`, `controllers/decoyController.js`, `utils/sqliDumpRotation.js`, `traps/tarpit.js` |
| 4 | `utils/xssPayloadClassifier.js`, `traps/sandboxXSS.js`, `views/decoy/sandbox-xss.ejs` |
| 5 | `utils/loginBruteTrap.js`, `controllers/realController.js`, `traps/fakeLogin.js`, `utils/legacyBreachSession.js` |
| 6 | `packages/shared-constants/honeyTokens.js`, `middleware/honeyTokenDetector.js`, `utils/honeyTokenFlow.js`, `traps/honeyToken.js` |
| 7 | `admin-panel` Attack Monitor · Investigate tab |

See also: [README.md](../README.md) (Attack demo guide) · [ARCHITECTURE.md](ARCHITECTURE.md) · [scripts/yaniv-test/README.md](../scripts/yaniv-test/README.md).
