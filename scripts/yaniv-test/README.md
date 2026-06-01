# yaniv-test — Trap Simulation

> **Owner:** Yaniv · End-to-end QA scripts for demos and grading

Shell scripts that fire each trap type against a running stack, so you can verify the full
pipeline — Gatekeeper (Sagiv) → decoys (Bar) → telemetry (Max) → dashboard (Yaniv) — in one go.

## Contents

- `01-scanner.sh` … `12-scanner-breadcrumbs.sh` — one script per attack type
- `run-all.sh` — runs every trap in sequence
- `run-kill-chain.sh` — runs a realistic multi-step attack chain
- `config.example.env` — copy and edit for your host/URL

## Usage

```bash
# from the repo root, with the stack running (Docker or pnpm dev:full)
pnpm trap:demo    # run-all.sh
pnpm trap:chain   # run-kill-chain.sh
```
