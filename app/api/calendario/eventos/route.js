import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, excluirLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, podeEditar, empresasVisiveis } from '@/lib/auth'
import { novoId } from '@/lib/uuid'

const COLS = ['id', 'empresaId', 'empresaNome', 'titulo', 'data', 'descricao', 'criadoPor', 'criadoEm']

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    await garantirAba('EventosCalendario', COLS)
    const todasEmpresas = await lerAba('Empresas')
    const permitidas = new Set(empresasVisiveis(usuario, todasEmpresas.filter(e => e.id)).map(e => String(e.id).trim()))

    const linhas = (await lerAba('EventosCalendario')).filter(e => e.id)
    const eventos = linhas
      .filter(e => !e.empresaId || permitidas.has(String(e.empresaId).trim()))
      .map(e => ({
        id: e.id, empresaId: e.empresaId || '', empresaNome: e.empresaNome || '',
        titulo: e.titulo || '', data: e.data || '', descricao: e.descricao || '',
      }))
    return NextResponse.json({ sucesso: true, eventos })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id, empresaId, titulo, data, descricao } = await req.json()
    if (!titulo || !data) return NextResponse.json({ sucesso: false, erro: 'Título e data são obrigatórios.' })

    await garantirAba('EventosCalendario', COLS)

    let empresaNome = ''
    if (empresaId) {
      const todas = await lerAba('Empresas')
      const permitidas = empresasVisiveis(usuario, todas.filter(e => e.id))
      const empresa = permitidas.find(e => String(e.id).trim() === String(empresaId).trim())
      if (!empresa) return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })
      empresaNome = empresa.nome
    }

    if (id) {
      const r = await atualizarLinha('EventosCalendario', 'id', id, { empresaId: empresaId || '', empresaNome, titulo, data, descricao: descricao || '' })
      if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
      return NextResponse.json({ sucesso: true, id })
    }
    const novoIdGerado = novoId()
    const r = await adicionarLinha('EventosCalendario', {
      id: novoIdGerado, empresaId: empresaId || '', empresaNome, titulo, data, descricao: descricao || '',
      criadoPor: usuario.email || usuario.nome || '', criadoEm: new Date().toISOString(),
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true, id: novoIdGerado })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao salvar: ' + e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ sucesso: false, erro: 'ID obrigatório.' })
    const r = await excluirLinha('EventosCalendario', 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao excluir: ' + e.message }, { status: 500 })
  }
}
