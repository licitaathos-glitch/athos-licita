import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { criarToken, SEGUNDOS_SESSAO } from '@/lib/session'

// Aceita as variações que o Sheets pode devolver para "ativo"
function estaAtivo(v) {
  const s = String(v ?? '').trim().toLowerCase()
  if (['false', 'falso', '0', 'nao', 'não', 'no'].includes(s)) return false
  return true // true, verdadeiro, sim, vazio → considera ativo
}

export async function POST(req) {
  try {
    const { email, pin } = await req.json()
    if (!email || !pin) {
      return NextResponse.json({ sucesso: false, erro: 'Informe e-mail e PIN.' })
    }
    const usuarios = await lerAba('Usuarios')
    const emailBusca = String(email).trim().toLowerCase()
    const pinBusca = String(pin).trim()

    const u = usuarios.find(x =>
      String(x.email || '').trim().toLowerCase() === emailBusca &&
      String(x.pin || x.senha || '').trim() === pinBusca &&
      estaAtivo(x.ativo)
    )
    if (!u) return NextResponse.json({ sucesso: false, erro: 'E-mail ou PIN incorretos.' })

    const usuario = {
      id: u.id, nome: u.nome, email: u.email, perfil: u.perfil,
      empresa_id: u.empresa_id || '',
      empresas_permitidas: u.empresas_permitidas || '',
      menus: u.menus || '',
      menus_por_empresa: u.menus_por_empresa || '',
    }
    const token = await criarToken(usuario)
    const res = NextResponse.json({ sucesso: true, usuario })
    res.cookies.set('athos_sessao', token, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: SEGUNDOS_SESSAO, path: '/',
    })
    return res
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message })
  }
}
