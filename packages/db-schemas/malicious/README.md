# Malicious DB Schemas

> **Owner:** Max · **Mission 3.3**

Attacker intelligence models. In production, only the telemetry service
([`../../../services/logging-data-extraction`](../../../services/logging-data-extraction)) writes these collections.

| File | Stores |
|------|--------|
| `AttackerProfile.js` | Per-IP attacker intel and fingerprint |
| `AttackEvent.js` | One document per trap trigger |
| `HoneyToken.js` | Trackable fake credentials (Bar issues them, Max stores them) |
