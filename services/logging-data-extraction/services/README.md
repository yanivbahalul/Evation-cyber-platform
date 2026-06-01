## TELEMETRY SERVICES

Owner: Max

  AttackEventService.js     Persists attack_events collection
  AttackerProfileService.js Upserts attacker profiles, banned IP reads
  honeyTokenService.js      Honey token lifecycle
  SocketService.js          socket.io liveAlert broadcast (Mission 3.2)
  geoService.js             IP to lat/long for Yaniv's map (Mission 4.3)
  LoggerService.js          Structured logging / wasted_time_ms metrics

Mission 3.1: User-Agent and header fingerprinting into JSON profiles.
Mission 3.3: All writes use separate mongoose connection — no safezone leak.
