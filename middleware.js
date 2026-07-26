import { NextResponse } from 'next/server'
import { lerToken } from '@/lib/session'

export async function middleware(req) {
  const token = req.cookies.get('athos_sessao')?.value
  const usuario = token ? await lerToken(token) : null
  if (!usuario) return NextResponse.redirect(new URL('/login', req.url))
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
