# `POST /api/admin/register`

> **Owner:** Yaniv

Creates a new admin account. The account stays unprivileged until an existing admin grants
the `admin` role. OTP confirmation happens in [`verify-otp/`](verify-otp/).
