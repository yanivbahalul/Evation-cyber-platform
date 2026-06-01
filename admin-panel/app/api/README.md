API ROUTES (Next.js App Router)
Owner: Yaniv — Mission 4.1 Secure Administrative API

All handlers under app/api/admin/ require admin JWT unless noted.

  portal/session/     Gateway session bridge (role check for HR portal)
  admin/dashboard/    Dashboard aggregate data
  admin/stats/          Live stats counters
  admin/events/         Attack event list
  admin/ban/            Ban IP
  admin/honeytokens/    Honey token management
  admin/users/          Admin user CRUD, reset-2fa
  admin/attackers/[ip]/timeline/  Per-IP investigation timeline
  admin/2fa/enroll/     TOTP enrollment
  admin/register/       Admin signup + verify-otp

See each subfolder README.md for that route only.
