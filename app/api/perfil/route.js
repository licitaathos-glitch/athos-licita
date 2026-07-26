import { NextResponse } from 'next/server'
import { lerAba, atualizarLinha } from '@/lib/google'
import { getUsuarioFromReq } from '@/lib/auth'

// Altera o PIN do próprio usuário logado
export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    const { pinAtual, novoPin } = await req.json()
    if (!/^\d{6}$/.test(String(novoPin || ''))) {
      return NextResponse.json({ sucesso: false, erro: 'O novo PIN deve ter exatamente 6 dígitos.' })
    }

    const usuarios = await lerAba('Usuarios')
    const emailBusca = String(usuario.email || '').trim().toLowerCase()
    const u = usuarios.find(x => String(x.email || '').trim().toLowerCase() === emailBusca)
    if (!u) return NextResponse.json({ sucesso: false, erro: 'Usuário não encontrado.' })

    if (String(u.pin || '').trim() !== String(pinAtual || '').trim()) {
      return NextResponse.json({ sucesso: false, erro: 'PIN atual incorreto.' })
    }
    if (String(novoPin) === String(pinAtual)) {
      return NextResponse.json({ sucesso: false, erro: 'O novo PIN deve ser diferente do atual.' })
    }

    const r = await atualizarLinha('Usuarios', 'email', usuario.email, { pin: String(novoPin) })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}
