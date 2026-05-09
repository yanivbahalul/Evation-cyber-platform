import type { NextRequest } from 'next/server'
import { verifyJwt } from './jwt'

export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get('admin_auth')?.value
  if (!token) throw new Error('missing_auth')
  return await verifyJwt<{ sub: string }>(token, 'auth')
}

