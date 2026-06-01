# Shared Constants

Single source of truth for values that must match across services. **Change only with
team agreement** — a mismatch here breaks detection, logging, and the dashboard at once.

| File | Provides |
|------|----------|
| `trapTypes.js` | `TRAP_TYPES` enum — `SQLI`, `XSS`, `DATA_BOMB`, `HONEY_TOKEN`, … |

Used by gateway traps (Bar), telemetry (Max), and dashboard labels (Yaniv).
