import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin, empresasVisiveis } from '@/lib/auth'

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  const todas = await lerAba('Empresas')
  const empresas = empresasVisiveis(usuario, todas.filter(e => e.id))
  return NextResponse.json({ sucesso: true, empresas })
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem incluir empresas.' }, { status: 403 })

  try {
    const { nome, cnpj, responsavel } = await req.json()
    if (!nome) return NextResponse.json({ sucesso: false, erro: 'Informe o nome da empresa.' })

    const todas = await lerAba('Empresas')
    const proximoId = String(todas.reduce((max, e) => Math.max(max, parseInt(e.id) || 0), 0) + 1)

    const r = await adicionarLinha('Empresas', {
      id: proximoId, nome, cnpj: cnpj || '', responsavel: responsavel || '',
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true, id: proximoId })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}
