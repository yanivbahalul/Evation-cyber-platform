import {
  authCookieMaxAgeSeconds,
  authJwtExpiresIn,
  pre2faMaxAgeSeconds,
  CLEAR_AUTH_COOKIE_NAMES,
} from '@evation/shared-utils'

export { authCookieMaxAgeSeconds, authJwtExpiresIn, pre2faMaxAgeSeconds, CLEAR_AUTH_COOKIE_NAMES }

type CookieInput = {
  name: string
  value: string
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  secure?: boolean
  path?: string
  maxAge?: number
}

/** Apply configured maxAge; omit for session cookies (close browser → gone). */
export function withAuthMaxAge(cookie: CookieInput, maxAgeSec = authCookieMaxAgeSeconds()): CookieInput {
  if (maxAgeSec == null) {
    const { maxAge: _drop, ...rest } = cookie
    return rest
  }
  return { ...cookie, maxAge: maxAgeSec }
}

export function clearedAuthCookies(
  sameSite: 'strict' | 'lax' = 'strict',
): Array<CookieInput & { maxAge: 0 }> {
  const secure = process.env.NODE_ENV === 'production'
  return CLEAR_AUTH_COOKIE_NAMES.map((name) => ({
    name,
    value: '',
    httpOnly: true,
    sameSite: name === 'auth' || name === 'preauth' || name === 'legacy_admin_sess' ? 'lax' : sameSite,
    secure,
    path: '/',
    maxAge: 0,
  }))
}
