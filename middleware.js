import { NextResponse } from 'next/server'
import { criarToken, lerToken, SEGUNDOS_SESSAO } from '@/lib/session'

// Renovação deslizante: a cada visita a uma tela do sistema o cookie é
// reemitido com o prazo cheio. Quem usa toda semana nunca precisa logar de
// novo; quem some por mais de 90 dias, sim.
export async function middleware(req) {
  const token = req.cookies.get('athos_sessao')?.value
  const usuario = token ? await lerToken(token) : null
  if (!usuario) return NextResponse.redirect(new URL('/login', req.url))

  const res = NextResponse.next()
  try {
    res.cookies.set('athos_sessao', await criarToken(usuario), {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: SEGUNDOS_SESSAO, path: '/',
    })
  } catch {}
  return res
}

export const config = { matcher: ['/dashboard/:path*'] }
