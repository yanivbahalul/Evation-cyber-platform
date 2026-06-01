DB LIBRARY (admin reads)
Owner: Yaniv (read paths); schemas owned by Sagiv and Max

  maliciousDb.js — Read attack data for dashboard APIs
  (safezone connections as needed for admin user management)

Writes to malicious DB should go through telemetry service (Max), not admin-panel.
