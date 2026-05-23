import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ success: true })
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  } as const

  for (const name of ['admin_auth', 'pre_2fa']) {
    res.cookies.set({ name, value: '', sameSite: 'strict', ...cookieOpts })
  }
  res.cookies.set({ name: 'auth', value: '', sameSite: 'lax', ...cookieOpts })
  return res
}

