import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, excluirLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, podeEditar, empresasVisiveis } from '@/lib/auth'
import { novoId } from '@/lib/uuid'

// Tarefas soltas do dia a dia — não são eventos de calendário nem etapas de
// licitação. Podem ou não estar ligadas a uma empresa e a uma licitação.
export const COLS_TAREFA = ['id', 'empresaId', 'empresaNome', 'titulo', 'descricao', 'prazo',
  'prioridade', 'status', 'licitacaoId', 'licitacaoEdital', 'criadoPor', 'criadoEm', 'concluidoEm']

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    await garantirAba('Tarefas', COLS_TAREFA)
    const todas = await lerAba('Empresas')
    const permitidas = new Set(empresasVisiveis(usuario, todas.filter(e => e.id)).map(e => String(e.id).trim()))

    const tarefas = (await lerAba('Tarefas'))
      .filter(t => t.id)
      .filter(t => !t.empresaId || permitidas.has(String(t.empresaId).trim()))
      .map(t => ({
        id: t.id, empresaId: t.empresaId || '', empresaNome: t.empresaNome || '',
        titulo: t.titulo || '', descricao: t.descricao || '', prazo: t.prazo || '',
        prioridade: t.prioridade || 'Normal', status: t.status || 'Pendente',
        licitacaoId: t.licitacaoId || '', licitacaoEdital: t.licitacaoEdital || '',
        criadoEm: t.criadoEm || '', concluidoEm: t.concluidoEm || '',
      }))
      // Pendentes primeiro, e dentro delas as de prazo mais próximo
      .sort((a, b) => {
        if ((a.status === 'Concluída') !== (b.status === 'Concluída')) return a.status === 'Concluída' ? 1 : -1
        if (!a.prazo) return 1
        if (!b.prazo) return -1
        return String(a.prazo).localeCompare(String(b.prazo))
      })

    return NextResponse.json({ sucesso: true, tarefas })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const b = await req.json()
    if (!b.titulo?.trim()) return NextResponse.json({ sucesso: false, erro: 'Informe o que precisa ser feito.' })

    await garantirAba('Tarefas', COLS_TAREFA)

    let empresaNome = ''
    if (b.empresaId) {
      const todas = await lerAba('Empresas')
      const empresa = empresasVisiveis(usuario, todas.filter(e => e.id))
        .find(e => String(e.id).trim() === String(b.empresaId).trim())
      if (!empresa) return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })
      empresaNome = empresa.nome
    }

    const campos = {
      empresaId: b.empresaId || '', empresaNome,
      titulo: b.titulo.trim(), descricao: b.descricao || '', prazo: b.prazo || '',
      prioridade: b.prioridade || 'Normal', status: b.status || 'Pendente',
      licitacaoId: b.licitacaoId || '', licitacaoEdital: b.licitacaoEdital || '',
      // Só carimba a conclusão na primeira vez que a tarefa é marcada
      concluidoEm: b.status === 'Concluída' ? (b.concluidoEm || new Date().toISOString()) : '',
    }

    if (b.id) {
      const r = await atualizarLinha('Tarefas', 'id', b.id, campos)
      if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
      return NextResponse.json({ sucesso: true, id: b.id })
    }

    const id = novoId()
    const r = await adicionarLinha('Tarefas', {
      id, ...campos,
      criadoPor: usuario.email || usuario.nome || '', criadoEm: new Date().toISOString(),
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true, id })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao salvar: ' + e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ sucesso: false, erro: 'Informe a tarefa.' })
    const r = await excluirLinha('Tarefas', 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro || 'Tarefa não encontrada.' })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
