# yaniv-test — סימולציית תקיפות מרחוק (InnoTech Honeypot)

סקריפטי `curl` להפעלה **ממחשב אחר** נגד כתובת IP או DNS של שרת ה-honeypot (פורט 3000, נתיב `/gateway`).

> **הרשאה בלבד:** השתמשו רק במערכות שבבעלותכם או שקיבלתם אישור מפורש לבדוק (מעבדה, דמו, QA). הסקריפטים מיועדים לבדיקת מלכודות הפלטפורמה — לא לתקיפת אתרים חיצוניים.

## דרישות במחשב התוקף

- `bash`, `curl`
- גישת רשת ל-`TARGET:PORT` (בד"כ `3000`)
- בשרת היעד: `pnpm dev:full` רץ, ו-`DEV_PUBLIC_HOST` ב-`.env.local` תואם ל-IP/DNS שהלקוחות משתמשים בו

## התקנה מהירה

```bash
cd scripts/yaniv-test
cp config.example.env config.env
# ערכו TARGET=כתובת_השרת
chmod +x *.sh lib/common.sh
```

## משתני סביבה

| משתנה | ברירת מחדל | תיאור |
|--------|------------|--------|
| `TARGET` / `HOST` | `localhost` | IP או DNS של שרת ה-admin-panel |
| `PORT` | `3000` | פורט ה-UI |
| `SCHEME` | `http` | `http` או `https` |
| `GATEWAY_PATH` | `/gateway` | נתיב הפרוקסי ל-gateway |
| `PAUSE` | `1.5` | השהיה בין שלבים (שניות) |
| `KEEP_COOKIE` | `0` | `1` = לא למחוק קובץ עוגיות (למעקב traceId) |

אפשר גם בלי `config.env`:

```bash
TARGET=10.0.0.5 ./01-scanner.sh
TARGET=honey.lab.local PORT=3000 ./run-all.sh
```

## סקריפטים לפי סוג מלכודת

| קובץ | מלכודת | צפוי ב-dashboard |
|------|--------|------------------|
| `01-scanner.sh` | Scanner UA (sqlmap) | `SCANNER` |
| `02-recon.sh` | חשיפת `.env` / recon | `RECON` |
| `03-sqli-login.sh` | SQLi בלוגין | `SQLI` |
| `03b-sqli-database.sh` | שאילתה במסוף DB מזויף | `SQLI` |
| `04-xss-probe.sh` | XSS probe (alert) | `XSS_PROBE` |
| `05-xss-blocked.sh` | XSS חסום | `XSS_PROBE` (blocked) |
| `06-path-traversal.sh` | LFI | `PATH_TRAVERSAL` |
| `07-ssrf.sh` | SSRF metadata | `SSRF` |
| `08-data-bomb.sh` | הורדת ZIP מזויף | `DATA_BOMB` |
| `09-brute-force.sh` | 5× סיסמה שגויה | `BRUTE_FORCE` |
| `10-honey-token.sh` | מפתח API + Bearer | `HONEY_TOKEN` |
| `11-recon-console.sh` | מסוף אדמין מזויף | `RECON` |
| `12-scanner-breadcrumbs.sh` | robots.txt / sitemap | `SCANNER` / `RECON` |

## הרצה מרוכזת

```bash
# כל המלכודות ברצף (כמו demo-traps-lite)
./run-all.sh

# שרשרת הרג (מומלץ להדגמה — SQLi → XSS → bomb → brute → recon → token)
./run-kill-chain.sh
```

אחרי הרצה: פתחו `http://TARGET:3000/gateway/dashboard/` (מצב Demo **כבוי**) ובדקו **Investigate** לפי `traceId` שמודפס בסוף.

## מסמכים נוספים

- [ATTACK_DEMO_GUIDE.md](../../docs/ATTACK_DEMO_GUIDE.md) — פירוט מלא לכל מלכודת
- `../demo-traps-lite.sh` — גרסה מקומית קצרה (localhost)
