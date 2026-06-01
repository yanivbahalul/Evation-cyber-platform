# Decoy Views

> **Owner:** Bar · **Missions 2.1 & 2.3** — Decoy UI

Every `.ejs` file here is a fake "vulnerable" page rendered after the Gatekeeper (Sagiv)
silently reroutes a malicious request. The goal is for the attacker to believe they
reached a real, exploitable system.

- Paired trap logic lives in [`../../traps/`](../../traps) and `decoyController.js`.
- The fake admin dashboard is reseeded with random **Faker.js** data on every request, so
  scrapers never see the same thing twice.

> **Blue team only:** never link these URLs from the real HR UI. They exist purely to
> trap and observe attackers.
