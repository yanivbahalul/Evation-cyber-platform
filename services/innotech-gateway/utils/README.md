## GATEWAY UTILS


  telemetryClient.js  Reports traps to Max's POST /internal/attack (all traps)
  authCookies.js      Session cookies for safezone (Sagiv)
  adminTotpCrypto.js  TOTP helpers for gateway admin login (Sagiv/Yaniv overlap)

Bar's traps call telemetryClient after firing so Max + Yaniv see live alerts.
