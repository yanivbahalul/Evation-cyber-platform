# yaniv-test — סימולציית תקיפות (InnoTech Honeypot)

> **הרשאה בלבד:** השתמשו רק במערכות שבבעלותכם או עם אישור מפורש. לא לתקיפת אתרים חיצוניים.

---

## מה רואים ב-GitHub (בקצרה)

| תיקייה | תפקיד |
|--------|--------|
| [`apps/admin-panel/`](../../apps/admin-panel/) | ממשק Next.js + API של Blue Team |
| [`services/innotech-gateway/`](../../services/innotech-gateway/) | פורטל HR + מלכודות |
| [`services/logging-data-extraction/`](../../services/logging-data-extraction/) | טלמטריה + Socket.IO |
| [`infra/`](../../infra/) | Docker Compose + Nginx — **העלאת השרת** |
| `scripts/yaniv-test/` | סקריפטי `curl` לבדיקת מלכודות |

**Env:** [`apps/admin-panel/.env`](../../apps/admin-panel/.env) ← תבנית: [`.env.example`](../../apps/admin-panel/.env.example)

---

## העלאת השרת (Docker)

**דרישות:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) **רץ** (`docker ps` בלי שגיאה).

```bash
git clone <repo-url>
cd Evation-cyber-platform

cp apps/admin-panel/.env.example apps/admin-panel/.env
# ערכו apps/admin-panel/.env — Mongo Atlas, JWT, socket token (בלי @HOST)

cd infra
docker compose up --build
```

| URL | מה זה |
|-----|--------|
| http://localhost:8080/gateway/ | פורטל HR + מלכודות |
| http://localhost:8080/gateway/dashboard/ | Attack monitor (admin) |

**עצירה:** `Ctrl+C` או `docker compose down` (מתוך `infra/`).

**בדיקה:**
```bash
docker compose ps
docker compose logs gateway --tail 5   # server_listening
```

### בעיות נפוצות

| תסמין | פתרון |
|--------|--------|
| `Cannot connect to Docker daemon` | פתחו Docker Desktop |
| `ENOTFOUND _mongodb._tcp.HOST` | URIs אמיתיים ב-`apps/admin-panel/.env` |
| **502** על `/gateway/` | `docker compose logs gateway` → `docker compose up --build` |
| `cp .env` בתוך `infra/` | לא צריך — רק `apps/admin-panel/.env` |

---

## yaniv-test (אחרי שהשרת רץ)

```bash
cd scripts/yaniv-test
cp config.example.env config.env
```

`config.env`:
```bash
TARGET=localhost      # או IP של המחשב (192.168.x.x)
PORT=8080
SCHEME=http
```

```bash
chmod +x *.sh lib/common.sh
./run-all.sh
```

או מהשורש (אותו דבר): `pnpm trap:demo` / `pnpm trap:chain`

---

## דרישות

- `bash`, `curl`
- Docker stack רץ על המחשב היעד
- גישה ל-`http://TARGET:8080`
- מיגרציית HR (פעם אחת): `SAFEZONE_DB_URI=... node scripts/migrate-users-to-real-employees.js`

## משתני סביבה

| משתנה | ברירת מחדל | תיאור |
|--------|------------|--------|
| `TARGET` | `localhost` | IP/DNS של מכונת Docker |
| `PORT` | `8080` | פורט Nginx |
| `SCHEME` | `http` | |

## סקריפטים

| קובץ | בדיקה |
|------|--------|
| `01-scanner.sh` | Scanner UA tarpit |
| `02-recon.sh` | Recon URLs |
| `03-sqli-login.sh` | SQLi login bypass |
| `03b-sqli-database.sh` | SQLi database console |
| `04-xss-probe.sh` | XSS probe tier |
| `05-xss-blocked.sh` | XSS blocked tier |
| `06-path-traversal.sh` | LFI |
| `07-ssrf.sh` | SSRF |
| `08-data-bomb.sh` | Data bomb ZIP |
| `09-brute-force.sh` | Brute force handoff |
| `10-honey-token.sh` | Honey token |
| `11-recon-console.sh` | Fake admin console |
| `12-scanner-breadcrumbs.sh` | robots.txt / sitemap |

```bash
./run-all.sh
./run-kill-chain.sh
```

אחרי הרצה: dashboard → **Investigate** לפי `traceId`.

### Brute force (יציבות דמו)
הסף של מלכודת ה‑Brute Force **מוגרל בין 5 ל‑10 ניסיונות** (כדי להקשות על תוקפים להבין את החוקיות).
לכן `09-brute-force.sh` מנסה עד 10 פעמים ועוצר כשמזהה handoff.

## מסמכים

- [README.md — Attack demo guide](../../README.md#attack-demo-guide)
- [DEPLOYMENT.md](../../docs/DEPLOYMENT.md)
- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
