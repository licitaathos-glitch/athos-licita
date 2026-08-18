import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, garantirAba, excluirLinha } from '@/lib/google'
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
      editalAnexoUrl, resumoTexto, linkLicitacao, dataSessao, srp, resumoPdf } = await req.json()
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
        empresa: empresa.nome, numeroEdital, objeto, itens, mensagem, link, editalAnexoUrl,
        linkLicitacao, dataSessao, srp, resumo: resumoPdf || {},
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

// Atualiza o nº da cotação pelo painel — o fornecedor às vezes passa o número
// por telefone ou e-mail, sem usar o link, e ficava sem onde registrar.
export async function PATCH(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id, numeroCotacaoFornecedor } = await req.json()
    if (!id) return NextResponse.json({ sucesso: false, erro: 'Informe o pedido de cotação.' })

    await garantirAba('Cotacoes', COLS_COTACAO)
    const r = await atualizarLinha('Cotacoes', 'id', id, {
      numeroCotacaoFornecedor: numeroCotacaoFornecedor || '',
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro || 'Pedido não encontrado.' })

    // Confere se entrou mesmo: atualizarLinha só grava colunas que existem no
    // cabeçalho, e uma coluna faltando falharia calada
    const gravado = (await lerAba('Cotacoes')).find(c => String(c.id || '').trim() === String(id).trim())
    if (numeroCotacaoFornecedor && gravado && !String(gravado.numeroCotacaoFornecedor || '').trim()) {
      return NextResponse.json({ sucesso: false, erro: 'O número não entrou na planilha — confira a coluna numeroCotacaoFornecedor na aba Cotacoes.' })
    }
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
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

const esc = t => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const brl = v => (v === 0 || (v && !isNaN(Number(v))))
  ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  : null

// Corpo do e-mail de pedido de cotação. Reproduz o mesmo conteúdo do
// "Resumo (PDF)" da licitação (informações básicas, objeto, qualificação/
// prazos/condições, observações, anexos), acrescenta a tabela de itens com
// valor estimado unitário e total, e termina no botão de enviar a cotação.
function montarEmailPedido({ empresa, numeroEdital, objeto, itens, mensagem, link, editalAnexoUrl,
  linkLicitacao, dataSessao, srp, resumo = {} }) {

  const h2 = txt => `<h2 style="font-size:13px;font-weight:800;color:#145653;text-transform:uppercase;letter-spacing:.04em;margin:22px 0 8px;padding-bottom:5px;border-bottom:2px solid #B9A06B">${esc(txt)}</h2>`
  const p = (txt, extra = '') => `<p style="font-size:13px;color:#2E2D2F;line-height:1.55;margin:0 0 10px;${extra}">${esc(txt)}</p>`

  const dataProposta = doisDiasAntes(dataSessao)
  const linhaSRP = srp === 'Sim'
    ? 'Trata-se de Sistema de Registro de Preços (SRP).'
    : 'Não se trata de registro de preços.'

  // ── Informações básicas (mesmos campos do resumo em PDF) ──────────────
  const basicas = [
    ['Licitação', numeroEdital], ['Órgão', resumo.orgao], ['UASG', resumo.uasg],
    ['UF', resumo.uf], ['Modalidade', resumo.modalidade], ['Portal', resumo.portal],
    ['Nº PNCP', resumo.numeroPNCP], ['SRP', resumo.srp],
    ['Valor estimado', resumo.valorEstimado],
    ['Abertura', resumo.dataAbertura], ['Limite da proposta', resumo.dataLimite],
    ['Sessão de disputa', dataSessao],
    ['Data para apresentar proposta', dataProposta],
  ].filter(x => x[1])
    .map(x => `<tr>
      <td style="padding:6px 0;font-size:12.5px;color:#6B7280;width:190px;vertical-align:top">${esc(x[0])}</td>
      <td style="padding:6px 0;font-size:12.5px;color:#2E2D2F;font-weight:700">${esc(x[1])}</td>
    </tr>`).join('')

  // ── Qualificação, prazos e condições (o que a IA leu do edital) ───────
  const itensResumo = Array.isArray(resumo.itensResumo) ? resumo.itensResumo : []
  const blocoResumo = (resumo.analiseGeral || itensResumo.length) ? `
    ${h2('Qualificação, prazos e condições')}
    ${resumo.analiseGeral ? p(resumo.analiseGeral, 'font-weight:600') : ''}
    ${itensResumo.map(it => `<p style="font-size:12.5px;color:#2E2D2F;line-height:1.5;margin:0 0 10px">
      <strong style="text-transform:uppercase;display:block;color:#145653">${esc(it.label)}</strong>
      ${esc(it.resposta)}${it.detalhe ? ' — ' + esc(it.detalhe) : ''}
    </p>`).join('')}` : ''

  // ── Anexos ────────────────────────────────────────────────────────────
  const anexos = Array.isArray(resumo.anexos) ? resumo.anexos : []
  const listaAnexos = anexos.length ? anexos : (editalAnexoUrl ? [{ nome: 'Edital', url: editalAnexoUrl }] : [])
  const blocoAnexos = listaAnexos.length ? `
    ${h2('Anexos')}
    ${listaAnexos.map(a => `<p style="font-size:13px;margin:0 0 6px">
      <a href="${esc(a.url)}" style="color:#145653;font-weight:700">📎 ${esc(a.nome || 'Anexo')}</a></p>`).join('')}` : ''

  // ── Itens: quantidade, valor estimado unitário e total ────────────────
  let totalEstimado = 0
  let algumEstimado = false
  const linhas = itens.map(it => {
    const qtd = Number(it.quantidade) || 0
    const unit = Number(it.valorUnitarioRef)
    const temUnit = !isNaN(unit) && String(it.valorUnitarioRef ?? '').trim() !== ''
    const totalItem = temUnit ? unit * qtd : null
    if (temUnit) { algumEstimado = true; totalEstimado += totalItem }
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:12.5px">${esc(it.descricao || '')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:12.5px;text-align:center">${esc(it.quantidade || '')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:12.5px;text-align:center">${esc(it.unidade || '')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:12.5px;text-align:right">${temUnit ? brl(unit) : 'Sigiloso'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:12.5px;text-align:right">${totalItem !== null ? brl(totalItem) : '—'}</td>
    </tr>`
  }).join('')

  const rodapeTotal = algumEstimado ? `<tr>
      <td colspan="4" style="padding:9px 10px;font-size:12.5px;font-weight:800;color:#145653;text-align:right">Valor total estimado dos itens</td>
      <td style="padding:9px 10px;font-size:13px;font-weight:800;color:#145653;text-align:right">${brl(totalEstimado)}</td>
    </tr>` : ''

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3EFE7;font-family:-apple-system,sans-serif">
  <table width="100%"><tr><td align="center" style="padding:28px 14px">
  <table width="640" style="max-width:640px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#145653;padding:22px 26px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#B9A06B;letter-spacing:.1em">ATHOS LICITA</p>
      <p style="margin:6px 0 0;font-size:19px;font-weight:800;color:#fff">Pedido de cotação</p>
    </td></tr>
    <tr><td style="padding:24px 26px">
      <p style="font-size:13.5px;color:#2E2D2F;line-height:1.6;margin:0 0 14px">
        Prezados,<br /><br />
        Identifiquei uma licitação na qual há possibilidade de participação pela <strong>${esc(empresa)}</strong>. ${linhaSRP}
        Abaixo vai o resumo completo do edital e, ao final, os itens para os quais precisamos do seu melhor preço.
      </p>
      ${mensagem ? `<p style="font-size:13px;color:#2E2D2F;background:#F8FAFC;padding:10px 14px;border-radius:8px;margin:0 0 14px">${esc(mensagem)}</p>` : ''}

      ${h2('Informações básicas')}
      <table width="100%" style="border-collapse:collapse;margin-bottom:4px"><tbody>
        ${basicas}
        ${linkLicitacao ? `<tr><td style="padding:6px 0;font-size:12.5px;color:#6B7280">Link da licitação</td><td style="padding:6px 0;font-size:12.5px"><a href="${esc(linkLicitacao)}" style="color:#145653;font-weight:700">Acessar edital</a></td></tr>` : ''}
      </tbody></table>

      ${objeto ? h2('Objeto') + p(objeto) : ''}
      ${blocoResumo}
      ${resumo.observacoes ? h2('Observações') + p(resumo.observacoes) : ''}
      ${blocoAnexos}

      ${h2('Itens para cotação')}
      <table width="100%" style="border-collapse:collapse;margin-bottom:18px">
        <thead><tr style="background:#F8FAFC">
          <th style="padding:8px 10px;font-size:10.5px;color:#64748B;text-align:left">DESCRIÇÃO</th>
          <th style="padding:8px 10px;font-size:10.5px;color:#64748B">QTD</th>
          <th style="padding:8px 10px;font-size:10.5px;color:#64748B">UN</th>
          <th style="padding:8px 10px;font-size:10.5px;color:#64748B;text-align:right">VL. UNIT. ESTIMADO</th>
          <th style="padding:8px 10px;font-size:10.5px;color:#64748B;text-align:right">VL. TOTAL ESTIMADO</th>
        </tr></thead>
        <tbody>${linhas}${rodapeTotal}</tbody>
      </table>

      <p style="text-align:center;margin:0 0 10px">
        <a href="${esc(link)}" style="display:inline-block;background:#B9A06B;color:#145653;font-weight:800;font-size:15px;padding:13px 28px;border-radius:10px;text-decoration:none">Enviar minha cotação</a>
      </p>
      <p style="font-size:11.5px;color:#9CA3AF;text-align:center;margin:0">Não é preciso criar conta — o link abre direto o formulário de cotação.</p>
      <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center">Athos Licita — Consultoria em Licitações Públicas</p>
    </td></tr>
  </table></td></tr></table></body></html>`
}
