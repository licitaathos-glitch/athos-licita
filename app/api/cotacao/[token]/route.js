import { NextResponse } from 'next/server'
import { lerAba, atualizarLinha, garantirAba } from '@/lib/google'
import { chamarGAS } from '@/lib/gas'
import { COLS_COTACAO, parseItensCotacao } from '@/lib/cotacao'

export const maxDuration = 60

// ⚠️ Rota pública, sem autenticação — o token aleatório é a própria
// permissão. Só devolve o necessário para preencher esta cotação: o nome da
// empresa que está pedindo, o edital e a lista de itens. Nada de outras
// licitações, outras empresas, certidões ou dados financeiros.
export async function GET(req, { params }) {
  try {
    await garantirAba('Cotacoes', COLS_COTACAO)
    const linhas = await lerAba('Cotacoes')
    const c = linhas.find(x => x.token === params.token)
    if (!c) return NextResponse.json({ sucesso: false, erro: 'Link inválido ou expirado.' }, { status: 404 })

    return NextResponse.json({
      sucesso: true,
      cotacao: {
        empresaNome: c.empresaNome, numeroEdital: c.numeroEdital, objeto: c.objeto,
        mensagem: c.mensagem, status: c.status || 'Pendente',
        editalAnexoUrl: c.editalAnexoUrl || '', resumoTexto: c.resumoTexto || '',
        itens: parseItensCotacao(c.itensJson),
        respostaItens: parseItensCotacao(c.respostaItensJson),
        numeroCotacaoFornecedor: c.numeroCotacaoFornecedor || '',
        anexoDriveUrl: c.anexoDriveUrl || '',
      },
    })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req, { params }) {
  try {
    const { precos, numeroCotacaoFornecedor, respondidoPor, base64, mimeType, nomeArquivo } = await req.json()
    if (!Array.isArray(precos) || !precos.length) {
      return NextResponse.json({ sucesso: false, erro: 'Informe ao menos um preço.' })
    }

    await garantirAba('Cotacoes', COLS_COTACAO)
    const linhas = await lerAba('Cotacoes')
    const c = linhas.find(x => x.token === params.token)
    if (!c) return NextResponse.json({ sucesso: false, erro: 'Link inválido ou expirado.' }, { status: 404 })

    let anexoDriveId = c.anexoDriveId || '', anexoDriveUrl = c.anexoDriveUrl || ''
    if (base64) {
      const up = await chamarGAS({
        action: 'uploadAnexoEdital', base64, mimeType: mimeType || 'application/pdf',
        nomeArquivo: nomeArquivo || 'cotacao.pdf', empresaNome: c.empresaNome || 'Geral',
      })
      if (up && up.ok) { anexoDriveId = up.driveFileId; anexoDriveUrl = up.driveFileUrl }
    }

    const r = await atualizarLinha('Cotacoes', 'token', params.token, {
      respostaItensJson: JSON.stringify(precos),
      numeroCotacaoFornecedor: numeroCotacaoFornecedor || '',
      respondidoPor: respondidoPor || '',
      anexoDriveId, anexoDriveUrl,
      status: 'Respondida', respondidoEm: new Date().toISOString(),
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao enviar: ' + e.message }, { status: 500 })
  }
}
