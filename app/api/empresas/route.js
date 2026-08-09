import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin, empresasVisiveis } from '@/lib/auth'
import { novoId } from '@/lib/uuid'

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
    const { nome, cnpj, responsavel, email, telefone } = await req.json()
    if (!nome) return NextResponse.json({ sucesso: false, erro: 'Informe o nome da empresa.' })

    const id = novoId()
    const r = await adicionarLinha('Empresas', {
      id, nome, cnpj: cnpj || '', responsavel: responsavel || '',
      email: email || '', telefone: telefone || '',
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true, id })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}

export async function PUT(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem editar empresas.' }, { status: 403 })

  try {
    const { id, nome, cnpj, responsavel, email, telefone } = await req.json()
    if (!id) return NextResponse.json({ sucesso: false, erro: 'Informe a empresa.' })
    if (!nome) return NextResponse.json({ sucesso: false, erro: 'Informe o nome da empresa.' })

    const r = await atualizarLinha('Empresas', 'id', id, {
      nome, cnpj: cnpj || '', responsavel: responsavel || '', email: email || '', telefone: telefone || '',
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}
