# InnoTech Gateway

> **Owners:** Sagiv Levy (safe zone + Gatekeeper) · Bar (deception + traps)
> **Stack:** Express + EJS · **Port:** `4001`

The honeypot's front door. It serves a believable corporate HR portal to real
employees and silently reroutes attackers into decoy pages and traps. It reports
every attack to the telemetry service but **never** touches the malicious database itself.

## Folder map

| Folder | Owner | What's inside |
|--------|-------|---------------|
| [`middleware/`](middleware/) | Sagiv | Gatekeeper: IP bans, SQLi/XSS detection, silent reroute |
| [`controllers/`](controllers/) | Sagiv + Bar | `realController` (HR app) and `decoyController` (traps) |
| [`traps/`](traps/) | Bar | Data bomb, tarpit, fake login, honey token, sandbox XSS, … |
| [`views/`](views/) | Sagiv + Bar | Real HR pages and `views/decoy/` fake vulnerable UIs |
| [`services/`](services/) | Sagiv | `detectionService`, `banService`, telemetry client |
| [`models/`](models/) | Sagiv | Local safezone model wiring (canonical schemas in `packages/db-schemas`) |
| [`config/`](config/) | Sagiv | App and environment configuration |
| [`public/`](public/) | Sagiv | Corporate CSS and static assets |
| [`utils/`](utils/) | Sagiv + Bar | Cookies, telemetry HTTP client, TOTP crypto |

## Key rule

The gateway is **air-gapped from the malicious DB**. Attack data leaves only as an
HTTP report to [`../logging-data-extraction`](../logging-data-extraction) (Max), which performs the writes.
