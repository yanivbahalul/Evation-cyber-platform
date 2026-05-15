# Decoy Engine — Integration Notes (Bar)

This branch (`bar/decoy-engine`) **only adds new files**. Nothing existing
was modified. To wire the engine in, three tiny edits are needed plus one
dependency install. Sagiv, please apply.

---

## 1. Install the Faker dependency

The dynamic admin dashboard uses Faker.js. From `services/innotech-gateway/`:

```bash
npm install @faker-js/faker
```

---

## 2. Edit `services/innotech-gateway/app.js` (3 small changes)

### a. Require the new decoy controller and honey-token detector

Add near the other requires at the top of the file:

```js
const decoyController     = require('./controllers/decoyController');
const honeyTokenDetector  = require('./middleware/honeyTokenDetector');
```

### b. Mount the honey-token detector right after `cookieParser`
(before `gatekeeper` — so any token in the request is checked before reroute):

```js
app.use(cookieParser());
app.use(honeyTokenDetector);   // ← ADD THIS LINE
```

### c. Replace the placeholder `/decoy-portal` handler with the dispatcher

**Current (lines ~110–113):**
```js
app.all('/decoy-portal', (req, res) => {
    res.render('decoy'); 
});
```

**Replace with:**
```js
// Main dispatcher — dispatches to the right trap based on req.threatInfo.type
app.all('/decoy-portal', decoyController.dispatch);

// Direct trap routes (for traps that aren't auto-triggered by signature)
app.post('/decoy-portal/login',       decoyController.fakeLogin);
app.get ('/decoy-portal/data-bomb',   decoyController.serveDataBomb);
app.get ('/decoy-portal/honey-token', decoyController.serveHoneyToken);
```

---

## 3. Verify the Malicious DB connection helper exists

The decoy code imports `../../logging-data-extraction/config/maliciousDb`.
That path is already present in Max's tree (`services/logging-data-extraction/config/maliciousDb.js`).
No action needed — just flagging it so you know we share that connection.

---

## What the engine does once wired

| Threat type (from Sagiv's gatekeeper) | Trap fired                  | Effect on attacker                              |
|----------------------------------------|-----------------------------|-------------------------------------------------|
| `SQLI`                                 | Tarpit                      | 30–120 s of "Querying database..." then fake MySQL error |
| `XSS`                                  | Sandbox XSS                 | Payload captured, rendered as inert text         |
| *(none — recon traffic)*               | Faker Admin Dashboard       | Fresh fake "InnoTech Corp" page every request    |

Plus three trap routes triggered directly:

| Route                          | Trap            | Notes                                                  |
|--------------------------------|-----------------|--------------------------------------------------------|
| `POST /decoy-portal/login`     | Fake Login      | 10th attempt → 10 s stall → 423 locked                 |
| `GET  /decoy-portal/data-bomb` | Data Bomb       | 100 GB stream with backpressure                        |
| `GET  /decoy-portal/honey-token` | Honey Token   | Issues bait creds, persisted to `HoneyToken` collection |

Every trap reports through `LoggerService.logAttack(...)` and
`SocketService.emitLiveAlert(...)` so the React dashboard updates live.

---

## Files added by this branch

```
services/innotech-gateway/
├── controllers/
│   └── decoyController.js          ← main dispatcher
├── middleware/
│   └── honeyTokenDetector.js       ← inspects every request for honey creds
├── traps/
│   ├── tarpit.js
│   ├── fakeLogin.js
│   ├── sandboxXSS.js
│   ├── dataBomb.js
│   └── honeyToken.js
└── views/decoy/
    ├── admin-dashboard.ejs         ← Faker-driven fake admin UI
    └── sandbox-xss.ejs             ← "guestbook saved" XSS catcher
```

---

## Open coordination items

- **Max** — your `TRAP_TYPES` enum currently has `DATA_BOMB, SQLI, BRUTE_FORCE, XSS`.
  Generic recon traffic (attacker landed on `/decoy-portal` without a specific
  signature) is logged as `DATA_BOMB` for now. If you'd like a separate
  `RECON` / `UNKNOWN` enum value, ping me and I'll update the dispatcher.
- **Max** — honey-token *generation* persists into your `HoneyToken` collection.
  Honey-token *usage detection* (middleware) appends to `triggeredLogs`. It
  intentionally does not call `LoggerService.logAttack` because there's no
  matching enum entry. If you want it surfaced in the AttackEvent feed too,
  add `HONEY_TOKEN` to `TRAP_TYPES` and I'll wire it.
- **Sagiv** — the honey-token detector reads `Authorization: Bearer`, `X-API-Key`,
  `?apiKey=`, and `body.apiKey`. If you'd like a different convention, say so.
