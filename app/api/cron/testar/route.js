import { NextResponse } from 'next/server'
import { getUsuarioFromReq, ehAdmin } from '@/lib/auth'

// Permite ao Adm disparar o alerta diário na hora, para conferir se está
// tudo certo, sem precisar esperar o horário agendado.
export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Somente administradores.' }, { status: 403 })

  const segredo = process.env.CRON_SECRET
  if (!segredo) return NextResponse.json({ sucesso: false, erro: 'CRON_SECRET não configurado no ambiente.' }, { status: 500 })

  const url = new URL('/api/cron/alertas-diarios', req.url)
  const r = await fetch(url, { headers: { Authorization: `Bearer ${segredo}` }, cache: 'no-store' })
  const dados = await r.json()
  return NextResponse.json(dados, { status: r.status })
}
