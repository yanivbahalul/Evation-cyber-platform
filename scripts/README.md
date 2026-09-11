# Scripts

Repo-level utilities for QA, demos, and database maintenance.

`pull-env.sh` downloads EVATION's validated `dev` secrets from Infisical into the ignored `infra/.env` file. Run it through `pnpm env:pull`; setup and key placement are documented in the [root README](../README.md#shared-secrets-with-infisical).

| Path | Owner | Purpose |
|------|-------|---------|
| [`yaniv-test/`](yaniv-test/) | Yaniv | End-to-end trap simulation (`pnpm trap:demo`, `pnpm trap:chain`) |
| `migrate-users-to-real-employees.js` | Sagiv | One-time safezone migration to the `RealEmployee` schema |
| `clear-attack-data.js` | Max | Wipes malicious-DB test data |
| `demo-traps-lite.sh` | — | Lightweight demo helper |
