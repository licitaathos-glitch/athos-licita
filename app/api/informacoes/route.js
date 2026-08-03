import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, excluirLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, podeEditar, podeAcessarMenu } from '@/lib/auth'
import { novoId } from '@/lib/uuid'
import { COLS_INFO, LINKS_PADRAO } from '@/lib/informacoes'

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'informacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })

  try {
    await garantirAba('Informacoes', COLS_INFO)
    let linhas = (await lerAba('Informacoes')).filter(l => l.id)

    // Primeira vez: semeia com os links padrão
    if (!linhas.length) {
      for (let i = 0; i < LINKS_PADRAO.length; i++) {
        const l = LINKS_PADRAO[i]
        await adicionarLinha('Informacoes', { id: novoId(), ordem: String(i), criadoEm: new Date().toISOString(), ...l })
      }
      linhas = (await lerAba('Informacoes')).filter(l => l.id)
    }

    const itens = linhas
      .map(l => ({ id: l.id, categoria: l.categoria || 'Outros', titulo: l.titulo || '', link: l.link || '', descricao: l.descricao || '', ordem: Number(l.ordem) || 0 }))
      .sort((a, b) => a.ordem - b.ordem)

    return NextResponse.json({ sucesso: true, itens })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'informacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id, categoria, titulo, link, descricao } = await req.json()
    if (!categoria || !titulo) return NextResponse.json({ sucesso: false, erro: 'Categoria e título são obrigatórios.' })

    await garantirAba('Informacoes', COLS_INFO)
    if (id) {
      const r = await atualizarLinha('Informacoes', 'id', id, { categoria, titulo, link: link || '', descricao: descricao || '' })
      if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
      return NextResponse.json({ sucesso: true, id })
    }
    const todas = await lerAba('Informacoes')
    const proximaOrdem = todas.length
    const novoIdGerado = novoId()
    const r = await adicionarLinha('Informacoes', {
      id: novoIdGerado, categoria, titulo, link: link || '', descricao: descricao || '',
      ordem: String(proximaOrdem), criadoEm: new Date().toISOString(),
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
  if (!podeAcessarMenu(usuario, 'informacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ sucesso: false, erro: 'ID obrigatório.' })
    const r = await excluirLinha('Informacoes', 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao excluir: ' + e.message }, { status: 500 })
  }
}
