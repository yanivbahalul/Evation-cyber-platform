# Views (EJS Templates)

Server-rendered pages for the gateway. The root templates are the **real** HR portal;
[`decoy/`](decoy/) holds the **fake** vulnerable UIs shown to attackers.

| Path | Owner | Purpose |
|------|-------|---------|
| Root `*.ejs` (`index`, `login`, `profile`, …) | Sagiv | Real InnoTech HR portal |
| [`partials/`](partials/) | Sagiv + Bar | Shared layout fragments (head, sidebar, topbar) |
| [`decoy/`](decoy/) | Bar | Fake "vulnerable" pages triggered by traps |

## Decoy pages (`decoy/`)

| File | Trap it sells |
|------|---------------|
| `database-console.ejs` | SQLi — fake query console |
| `fake-login.ejs` | Brute-force / legacy auth |
| `honey-token.ejs` | Fake API keys |
| `sandbox-xss.ejs` | XSS submission form |
| `file-viewer.ejs` | Path traversal (LFI) |
| `fetch-status.ejs` | SSRF |
| `admin-dashboard.ejs` | Fake admin — randomized **Faker.js** data per request (Mission 2.3) |
| `credential-dump.ejs` | Fake credential leak |
