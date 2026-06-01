DB SCHEMAS (Mongoose)

  admin/      Owner: Sagiv — AdminUser (admin_users) for Blue Team accounts
  safezone/   Owner: Sagiv — RealEmployee, SafezoneUser (legitimate HR data)
  malicious/  Owner: Max — AttackerProfile, AttackEvent, HoneyToken
  connect.js  Factory for safezone vs malicious connections (air-gap)

Mission 3.3: malicious/ uses mongoose.createConnection() — separate pool from safezone.

Yaniv reads malicious data via admin-panel and telemetry; does not own schemas.
