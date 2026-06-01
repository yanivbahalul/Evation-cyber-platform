## DECOY VIEWS

Owner: Bar (Mission 2.1 and 2.3 — Decoy UI)

Each .ejs file is a fake "vulnerable" page shown after Gatekeeper (Sagiv)
silently reroutes the request. Attacker should believe they reached a real system.

Paired trap logic lives in ../traps/ and decoyController.js.

Do not link these URLs from the real HR UI (Blue Team only for demos).
