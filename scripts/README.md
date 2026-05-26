# Scripts — מבנה התיקייה

```
scripts/
├── README.md           ← אתה כאן
├── yaniv-test/         ← סימולציית מלכודות (curl, TARGET=IP/DNS)
└── demo-traps-lite.sh  ← קיצור דרך ל-localhost → yaniv-test/run-all.sh
```

## סימולציית תקיפות (`scripts/yaniv-test/`)

להרצה **ממחשב אחר** (או מקומית) נגד honeypot. ראה [`yaniv-test/README.md`](./yaniv-test/README.md).

```bash
cd scripts/yaniv-test && cp config.example.env config.env
# TARGET=כתובת השרת
./run-all.sh
./run-kill-chain.sh
```

מהשורש:

```bash
pnpm trap:demo    # כל המלכודות
pnpm trap:chain   # שרשרת הדגמה
./scripts/demo-traps-lite.sh   # localhost
```

## סקריפטים שלא כאן (בכוונה)

| מיקום | סיבה |
|--------|------|
| `apps/admin-panel/scripts/` | כלי build/dev של Next.js בלבד |
| `services/logging-data-extraction/scripts/` | כלי שירות (למשל `verifyQaEvents.js`) |

## מסמכים

- [ATTACK_DEMO_GUIDE.md](../docs/ATTACK_DEMO_GUIDE.md) — מלכודות והדגמה בדפדפן
- [QA_MASTER_CHECKLIST.md](../docs/QA_MASTER_CHECKLIST.md) — צ'קליסט ידני (אופציונלי)
