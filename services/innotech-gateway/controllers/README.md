## CONTROLLERS


  realController.js   Owner: Sagiv — Legitimate HR app (login, workspace, dashboard)
  decoyController.js  Owner: Bar — All trap/decoy HTTP handlers after Gatekeeper

realController: MVC for safe zone, EJS renders, bcrypt passwords, Mongo safezone.

decoyController: Catches mutated requests from Sagiv's middleware; calls trap modules
and reports attacks to telemetry (Max).
