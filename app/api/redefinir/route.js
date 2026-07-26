import { NextResponse } from 'next/server'
import { lerAba, atualizarLinha } from '@/lib/google'

function parseData(v) {
  if (!v) return null
  const s = String(v)
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
  if (iso) return new Date(iso[1] + '-' + iso[2] + '-' + iso[3] + 'T' + iso[4] + ':' + iso[5] + ':00')
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (br) return new Date(br[3] + '-' + br[2] + '-' + br[1] + 'T' + br[4] + ':' + br[5] + ':00')
  const d = new Date(s)
  return isNaN(d) ? null : d
}

export async function POST(req) {
  try {
    const { email, token, novoPin } = await req.json()
    if (!email || !token || !novoPin) {
      return NextResponse.json({ sucesso: false, erro: 'Preencha todos os campos.' })
    }
    if (!/^\d{6}$/.test(String(novoPin))) {
      return NextResponse.json({ sucesso: false, erro: 'O novo PIN deve ter exatamente 6 dígitos.' })
    }

    const usuarios = await lerAba('Usuarios')
    const emailBusca = String(email).trim().toLowerCase()
    const u = usuarios.find(x => String(x.email || '').trim().toLowerCase() === emailBusca)
    if (!u) return NextResponse.json({ sucesso: false, erro: 'Código incorreto.' })

    const tokenSalvo = String(u.reset_token || '').trim()
    if (!tokenSalvo) return NextResponse.json({ sucesso: false, erro: 'Nenhuma solicitação ativa. Peça um novo código.' })
    if (tokenSalvo !== String(token).trim()) return NextResponse.json({ sucesso: false, erro: 'Código incorreto.' })

    const expira = parseData(u.reset_expira)
    if (expira && expira < new Date()) {
      return NextResponse.json({ sucesso: false, erro: 'Código expirado. Solicite um novo.' })
    }

    const r = await atualizarLinha('Usuarios', 'email', emailBusca, {
      pin: String(novoPin),
      reset_token: '',
      reset_expira: '',
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })

    return NextResponse.json({ sucesso: true, mensagem: 'PIN alterado! Faça login com o novo PIN.' })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro: ' + e.message })
  }
}
