import { NextResponse } from 'next/server'
import { clearedAuthCookies } from '@/lib/auth/cookiePolicy'

export const runtime = 'nodejs'

export function POST() {
  const res = NextResponse.json({ success: true })
  for (const cookie of clearedAuthCookies()) {
    res.cookies.set(cookie)
  }
  return res
}

