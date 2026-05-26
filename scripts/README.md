# Scripts — מבנה התיקייה

כל סקריפטי השורש של המונורפו נמצאים כאן, מחולקים לפי תפקיד.

```
scripts/
├── README.md           ← אתה כאן
├── qa/                 ← בדיקות אוטומטיות (מחשב מקומי, stack רץ)
├── yaniv-test/         ← סימולציית מלכודות מרחוק (curl, TARGET=IP/DNS)
└── demo-traps-lite.sh  ← קיצור דרך ל-localhost → yaniv-test/run-all.sh
```

## QA (`scripts/qa/`)

הרצה אחרי `pnpm dev:full`:

| פקודה | תיאור |
|--------|--------|
| `pnpm qa:smoke` | smoke + traps + API בסיסי |
| `pnpm qa:all` | smoke + auth-matrix + resilience + verify Mongo |

| קובץ | תפקיד |
|------|--------|
| `qa/smoke.sh` | S2–S3, RBAC, מלכודות T1–T10, שגיאות E1/E9 |
| `qa/auth-matrix.sh` | OTP, admin vs user, F3–F4 (דורש `QA_TEST_ADMIN_PASSWORD`) |
| `qa/resilience-extra.sh` | E4, E13, דף honey token |
| `qa/run-all.sh` | מריץ את שלושת הנ"ל + `verifyQaEvents.js` |

תוצאות: [`docs/qa-automated-results.txt`](../docs/qa-automated-results.txt)

## סימולציית תקיפות (`scripts/yaniv-test/`)

להרצה **ממחשב אחר** נגד honeypot (ענף `yaniv-test` ב-GitHub). ראה [`yaniv-test/README.md`](./yaniv-test/README.md).

```bash
cd scripts/yaniv-test && cp config.example.env config.env
# TARGET=כתובת השרת
./run-all.sh
./run-kill-chain.sh
```

## סקריפטים שלא כאן (בכוונה)

| מיקום | סיבה |
|--------|------|
| `apps/admin-panel/scripts/` | כלי build/dev של Next.js בלבד |
| `services/logging-data-extraction/scripts/` | אימות אירועים צמוד לשירות ה-telemetry |

## מסמכים

- [ATTACK_DEMO_GUIDE.md](../docs/ATTACK_DEMO_GUIDE.md) — מלכודות והדגמה בדפדפן
- [QA_MASTER_CHECKLIST.md](../docs/QA_MASTER_CHECKLIST.md) — צ'קליסט ידני + מיפוי ל-`qa/*`
