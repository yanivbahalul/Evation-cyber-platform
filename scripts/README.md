# Scripts

```
scripts/
├── README.md
├── yaniv-test/     ← trap simulation (curl)
└── demo-traps-lite.sh
```

## Server + traps

Full flow in [`yaniv-test/README.md`](./yaniv-test/README.md).

```bash
cp apps/admin-panel/.env.example apps/admin-panel/.env
cd infra && docker compose up --build

cd scripts/yaniv-test && cp config.example.env config.env
./run-all.sh
```

From repo root: `pnpm trap:demo` / `pnpm trap:chain` (server must be up on port **8080**).
