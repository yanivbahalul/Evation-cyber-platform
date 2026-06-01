# Controllers

The two sides of the gateway: one serves real employees, the other serves attackers.

| File | Owner | Responsibility |
|------|-------|----------------|
| `realController.js` | Sagiv | Legitimate HR app — landing page, login, workspace, dashboard. MVC with EJS rendering, bcrypt passwords, safezone MongoDB. |
| `decoyController.js` | Bar | Every trap/decoy HTTP handler. Catches requests rerouted by the Gatekeeper, invokes the matching [`../traps/`](../traps) module, and reports the attack to telemetry (Max). |

## Relationship

```text
Gatekeeper (Sagiv)  ──reroute──►  decoyController (Bar)  ──►  traps + telemetry report
Normal traffic      ──────────►  realController (Sagiv)  ──►  safezone HR pages
```
