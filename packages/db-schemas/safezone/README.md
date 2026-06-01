# Safezone Schemas

> **Owner:** Sagiv Levy · spec `REAL_EMPLOYEE`

| File | Collection | Purpose |
|------|------------|---------|
| `RealEmployee.js` | `real_employees` | Real HR portal users |
| `SafezoneUser.js` | — | Legacy / supporting safezone user model |

Legitimate app only. Passwords are hashed with **bcrypt**, and this data is never mixed
with the malicious database (Max).
