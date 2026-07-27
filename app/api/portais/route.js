import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, podeEditar } from '@/lib/auth'
import { novoId } from '@/lib/uuid'

const PADRAO = [
  { nome: 'Compras.gov.br / ComprasNet', link: 'https://www.gov.br/compras' },
  { nome: 'BLL Compras', link: 'https://bll.org.br' },
  { nome: 'Licitanet', link: 'https://www.licitanet.com.br' },
  { nome: 'BBMNET', link: 'https://www.bbmnet.com.br' },
  { nome: 'BNC — Bolsa Nacional de Compras', link: 'https://bnc.org.br' },
  { nome: 'Portal de Compras Públicas', link: 'https://www.portaldecompraspublicas.com.br' },
  { nome: 'Licitações-e (Banco do Brasil)', link: 'https://www.licitacoes-e.com.br' },
  { nome: 'PNCP', link: 'https://pncp.gov.br' },
]

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    await garantirAba('Portais', ['id', 'nome', 'link', 'observacao', 'criadoEm'])
    let portais = (await lerAba('Portais')).filter(p => p.nome)

    // Primeira carga: semeia com os portais mais usados
    if (!portais.length) {
      for (const p of PADRAO) {
        await adicionarLinha('Portais', { id: novoId(), nome: p.nome, link: p.link, observacao: '', criadoEm: new Date().toISOString() })
      }
      portais = (await lerAba('Portais')).filter(p => p.nome)
    }

    return NextResponse.json({
      sucesso: true,
      portais: portais.map(p => ({ id: p.id, nome: p.nome, link: p.link || '' }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    })
  } catch (e) {
    // Se a planilha falhar, ainda entregamos a lista padrão
    return NextResponse.json({ sucesso: true, portais: PADRAO.map((p, i) => ({ id: 'p' + i, ...p })) })
  }
}

// Cadastra um portal novo direto do formulário da licitação
export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { nome, link } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ sucesso: false, erro: 'Informe o nome do portal.' })

    await garantirAba('Portais', ['id', 'nome', 'link', 'observacao', 'criadoEm'])
    const existentes = await lerAba('Portais')
    const jaTem = existentes.some(p => String(p.nome || '').trim().toLowerCase() === nome.trim().toLowerCase())
    if (jaTem) return NextResponse.json({ sucesso: true, jaExistia: true })

    const r = await adicionarLinha('Portais', {
      id: novoId(), nome: nome.trim(), link: link || '', observacao: '', criadoEm: new Date().toISOString(),
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao salvar portal: ' + e.message }, { status: 500 })
  }
}
