import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { criarToken } from '@/lib/session'

export async function POST(req) {
  try {
    const { email, pin } = await req.json()
    if (!email || !pin) {
      return NextResponse.json({ sucesso: false, erro: 'Informe e-mail e PIN.' })
    }
    const usuarios = await lerAba('Usuarios')
    const u = usuarios.find(x =>
      String(x.email || '').trim().toLowerCase() === String(email).trim().toLowerCase() &&
      String(x.pin || x.senha || '') === String(pin) &&
      String(x.ativo) === 'true'
    )
    if (!u) return NextResponse.json({ sucesso: false, erro: 'E-mail ou PIN incorretos.' })

    const usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil }
    const token = await criarToken(usuario)
    const res = NextResponse.json({ sucesso: true, usuario })
    res.cookies.set('athos_sessao', token, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
    })
    return res
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message })
  }
}
