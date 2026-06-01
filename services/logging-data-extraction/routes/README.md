## ROUTES

Owner: Max

  internal.js — Internal API for gateway and admin (Bearer ADMIN_SOCKET_TOKEN)

  POST /internal/attack          Write event, upsert profile, broadcast liveAlert
  POST /internal/honey-token      Store issued bait credential
  GET  /internal/honey-token/check
  POST /internal/honey-token/usage
  GET  /internal/banned-ips       For Sagiv's gateway ban enforcement
  POST /internal/screen-resolution  Attacker fingerprint beacon

Mission 3.2: sub-second WebSocket alert to Yaniv's dashboard after each trap.
