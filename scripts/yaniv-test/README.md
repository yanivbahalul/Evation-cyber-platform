YANIV-TEST (trap simulation)
Owner: Yaniv — End-to-end QA scripts for demos and grading

Shell scripts fire each trap type against a running stack:
  01-scanner.sh through 12-scanner-breadcrumbs.sh
  run-all.sh, run-kill-chain.sh

Usage (from repo root):
  pnpm trap:demo
  pnpm trap:chain

Server must be up (Docker or pnpm dev:full). Config: config.example.env

Tests Sagiv Gatekeeper + Bar decoys + Max telemetry + Yaniv dashboard together.
