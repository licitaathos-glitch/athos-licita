import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, garantirAba, excluirLinha } from '@/lib/google'
import { getUsuarioFromReq, podeEditar, podeAcessarMenu, empresasVisiveis } from '@/lib/auth'
import { chamarGAS } from '@/lib/gas'
import { novoId } from '@/lib/uuid'
import { COLS_COTACAO, parseItensCotacao } from '@/lib/cotacao'

const SITE = 'https://athos-licita.vercel.app'

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const licitacaoId = searchParams.get('licitacaoId')
  if (!licitacaoId) return NextResponse.json({ sucesso: false, erro: 'Informe a licitação.' })

  try {
    await garantirAba('Cotacoes', COLS_COTACAO)
    const linhas = (await lerAba('Cotacoes')).filter(c => c.licitacaoId === licitacaoId)
    const cotacoes = linhas.map(c => ({
      id: c.id, destinatarioEmail: c.destinatarioEmail, status: c.status || 'Pendente',
      itens: parseItensCotacao(c.itensJson), respostaItens: parseItensCotacao(c.respostaItensJson),
      numeroCotacaoFornecedor: c.numeroCotacaoFornecedor || '', anexoDriveUrl: c.anexoDriveUrl || '',
      respondidoEm: c.respondidoEm || '', criadoEm: c.criadoEm || '', token: c.token,
    }))
    return NextResponse.json({ sucesso: true, cotacoes })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { licitacaoId, empresaId, numeroEdital, objeto, itens, destinatarioEmail, mensagem,
      editalAnexoUrl, resumoTexto, linkLicitacao, dataSessao, srp } = await req.json()
    if (!licitacaoId || !empresaId || !destinatarioEmail) {
      return NextResponse.json({ sucesso: false, erro: 'Faltam dados obrigatórios.' })
    }
    if (!Array.isArray(itens) || !itens.length) {
      return NextResponse.json({ sucesso: false, erro: 'Selecione ao menos um item para pedir cotação.' })
    }

    const empresas = empresasVisiveis(usuario, (await lerAba('Empresas')).filter(e => e.id))
    const empresa = empresas.find(e => String(e.id).trim() === String(empresaId).trim())
    if (!empresa) return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })

    await garantirAba('Cotacoes', COLS_COTACAO)
    const id = novoId()
    const token = novoId()

    const r = await adicionarLinha('Cotacoes', {
      id, licitacaoId, empresaId, empresaNome: empresa.nome,
      numeroEdital: numeroEdital || '', objeto: objeto || '',
      itensJson: JSON.stringify(itens), destinatarioEmail, mensagem: mensagem || '',
      editalAnexoUrl: editalAnexoUrl || '', resumoTexto: resumoTexto || '',
      linkLicitacao: linkLicitacao || '', dataSessao: dataSessao || '', srp: srp || '',
      token, status: 'Pendente', respostaItensJson: '[]',
      numeroCotacaoFornecedor: '', anexoDriveId: '', anexoDriveUrl: '',
      respondidoPor: '', respondidoEm: '', criadoEm: new Date().toISOString(),
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })

    const link = `${SITE}/cotacao/${token}`
    let avisoEmail = null
    try {
      const html = montarEmailPedido({
        empresa: empresa.nome, numeroEdital, objeto, itens, mensagem, link, editalAnexoUrl, resumoTexto,
        linkLicitacao, dataSessao, srp,
      })
      const env = await chamarGAS({
        action: 'enviarEmailGenerico', para: destinatarioEmail,
        assunto: `Pedido de cotação — ${numeroEdital || 'licitação'} (${empresa.nome})`,
        htmlBody: html,
      })
      if (!env || env.sucesso === false || env.erro) avisoEmail = (env && env.erro) || 'Não foi possível enviar o e-mail.'
    } catch (e) {
      avisoEmail = 'O pedido foi salvo, mas o e-mail não pôde ser enviado: ' + e.message
    }

    return NextResponse.json({ sucesso: true, id, token, link, avisoEmail })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao criar pedido: ' + e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ sucesso: false, erro: 'Informe o pedido de cotação.' })

  try {
    const r = await excluirLinha('Cotacoes', 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro || 'Pedido não encontrado.' })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

// Calcula "2 dias antes" de uma data BR "DD/MM/AAAA HH:MM" (ou só a parte da data)
function doisDiasAntes(dataBR) {
  const m = String(dataBR || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ''
  const d = new Date(+m[3], +m[2] - 1, +m[1])
  d.setDate(d.getDate() - 2)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function montarEmailPedido({ empresa, numeroEdital, objeto, itens, mensagem, link, editalAnexoUrl, resumoTexto, linkLicitacao, dataSessao, srp }) {
  const linhas = itens.map(it => `<tr>
    <td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:13px">${it.descricao || ''}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:13px;text-align:center">${it.quantidade || ''}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:13px;text-align:center">${it.unidade || ''}</td>
  </tr>`).join('')

  const dataProposta = doisDiasAntes(dataSessao)
  const linhaSRP = srp === 'Sim'
    ? 'Trata-se de Sistema de Registro de Preços (SRP).'
    : 'Não se trata de registro de preços.'

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3EFE7;font-family:-apple-system,sans-serif">
  <table width="100%"><tr><td align="center" style="padding:28px 14px">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#145653;padding:22px 26px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#B9A06B;letter-spacing:.1em">ATHOS LICITA</p>
      <p style="margin:6px 0 0;font-size:19px;font-weight:800;color:#fff">Pedido de cotação</p>
    </td></tr>
    <tr><td style="padding:24px 26px">
      <p style="font-size:14px;color:#2E2D2F;margin:0 0 14px">
        Prezados,<br /><br />
        Identifiquei uma licitação na qual há possibilidade de participação pela <strong>${empresa}</strong>. ${linhaSRP}
        Encaminho o edital para que possam avaliar a viabilidade de participação, e precisamos do seu melhor preço
        para os itens abaixo.
      </p>
      <table width="100%" style="border-collapse:collapse;margin-bottom:14px">
        <tbody>
          <tr><td style="padding:6px 0;font-size:13px;color:#6B7280;width:170px">Licitação</td><td style="padding:6px 0;font-size:13px;color:#2E2D2F;font-weight:700">${numeroEdital || '—'}</td></tr>
          ${linkLicitacao ? `<tr><td style="padding:6px 0;font-size:13px;color:#6B7280">Link da licitação</td><td style="padding:6px 0;font-size:13px"><a href="${linkLicitacao}" style="color:#145653;font-weight:700">Acessar edital</a></td></tr>` : ''}
          ${objeto ? `<tr><td style="padding:6px 0;font-size:13px;color:#6B7280;vertical-align:top">Objeto</td><td style="padding:6px 0;font-size:12.5px;color:#6B7280">${objeto}</td></tr>` : ''}
          ${dataSessao ? `<tr><td style="padding:6px 0;font-size:13px;color:#6B7280">Data da sessão</td><td style="padding:6px 0;font-size:13px;color:#2E2D2F;font-weight:700">${dataSessao}</td></tr>` : ''}
          ${dataProposta ? `<tr><td style="padding:6px 0;font-size:13px;color:#6B7280">Data para apresentar proposta</td><td style="padding:6px 0;font-size:13px;color:#2E2D2F;font-weight:700">${dataProposta}</td></tr>` : ''}
        </tbody>
      </table>
      ${mensagem ? `<p style="font-size:13px;color:#2E2D2F;background:#F8FAFC;padding:10px 14px;border-radius:8px;margin:0 0 14px">${mensagem}</p>` : ''}
      ${resumoTexto ? `<p style="font-size:12.5px;color:#2E2D2F;background:#F8FAFC;padding:10px 14px;border-radius:8px;margin:0 0 14px;white-space:pre-wrap">${resumoTexto}</p>` : ''}
      ${editalAnexoUrl ? `<p style="font-size:13px;margin:0 0 14px"><a href="${editalAnexoUrl}" style="color:#145653;font-weight:700">📎 Edital completo (anexo)</a></p>` : ''}
      <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#F8FAFC">
          <th style="padding:8px 10px;font-size:11px;color:#64748B;text-align:left">DESCRIÇÃO</th>
          <th style="padding:8px 10px;font-size:11px;color:#64748B">QTD</th>
          <th style="padding:8px 10px;font-size:11px;color:#64748B">UN</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="text-align:center;margin:0 0 10px">
        <a href="${link}" style="display:inline-block;background:#B9A06B;color:#145653;font-weight:800;font-size:15px;padding:13px 28px;border-radius:10px;text-decoration:none">Enviar minha cotação</a>
      </p>
      <p style="font-size:11.5px;color:#9CA3AF;text-align:center;margin:0">Não é preciso criar conta — o link abre direto o formulário de cotação.</p>
      <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center">Consultoria Athos Licita</p>
    </td></tr>
  </table></td></tr></table></body></html>`
}
