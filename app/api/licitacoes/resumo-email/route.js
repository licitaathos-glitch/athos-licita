import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { getUsuarioFromReq, podeAcessarMenu } from '@/lib/auth'
import { chamarGAS } from '@/lib/gas'
import { gerarResumoItens } from '@/lib/checklist'

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })

  const { licitacaoId, destinatarioEmail } = await req.json()
  if (!licitacaoId || !destinatarioEmail) return NextResponse.json({ sucesso: false, erro: 'Faltam dados.' })

  try {
    const lics = await lerAba('Licitacoes')
    const l = lics.find(x => x.id === licitacaoId)
    if (!l) return NextResponse.json({ sucesso: false, erro: 'Licitação não encontrada.' })

    let chkDados = {}
    try { chkDados = JSON.parse(l.checklistJson || '{}') } catch {}
    const resumoItens = gerarResumoItens(chkDados)
    const analiseGeral = chkDados._riscos || ''

    let anexos = []
    try { anexos = JSON.parse(l.anexosJson || '[]') } catch {}
    if (!anexos.length && l.anexoDriveUrl) anexos = [{ nome: 'Edital', url: l.anexoDriveUrl }]

    const html = montarEmailResumo({
      numeroEdital: l.numeroEdital, orgao: l.orgao, uf: l.uf, objeto: l.objeto,
      valor: l.valor, link: l.link, dataSessao: l.dataSessao || l.dataLimite || l.dataAbertura,
      resumoItens, analiseGeral, anexos, observacao: l.observacaoDisputa || '',
    })

    const env = await chamarGAS({
      action: 'enviarEmailGenerico', para: destinatarioEmail,
      assunto: `Resumo da licitação — ${l.numeroEdital || 'edital'}`,
      htmlBody: html,
    })
    if (!env || env.sucesso === false || env.erro) {
      return NextResponse.json({ sucesso: false, erro: (env && env.erro) || 'Não foi possível enviar o e-mail.' })
    }
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

function montarEmailResumo({ numeroEdital, orgao, uf, objeto, valor, link, dataSessao, resumoItens, analiseGeral, anexos, observacao }) {
  const itensHtml = resumoItens.map(it => `
    <p style="margin:0 0 10px">
      <strong style="text-transform:uppercase;display:block;font-size:11.5px;color:#145653;letter-spacing:.03em">${it.label}</strong>
      <span style="font-size:12.5px;color:#2E2D2F">${it.resposta}${it.detalhe ? ' — ' + it.detalhe : ''}</span>
    </p>`).join('')

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3EFE7;font-family:-apple-system,sans-serif">
  <table width="100%"><tr><td align="center" style="padding:28px 14px">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#145653;padding:22px 26px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#B9A06B;letter-spacing:.1em">ATHOS LICITA</p>
      <p style="margin:6px 0 0;font-size:19px;font-weight:800;color:#fff">Resumo da licitação</p>
    </td></tr>
    <tr><td style="padding:24px 26px">
      <table width="100%" style="border-collapse:collapse;margin-bottom:14px">
        <tbody>
          <tr><td style="padding:6px 0;font-size:13px;color:#6B7280;width:170px">Licitação</td><td style="padding:6px 0;font-size:13px;color:#2E2D2F;font-weight:700">${numeroEdital || '—'}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#6B7280">Órgão</td><td style="padding:6px 0;font-size:13px;color:#2E2D2F">${orgao || '—'}${uf ? '/' + uf : ''}</td></tr>
          ${objeto ? `<tr><td style="padding:6px 0;font-size:13px;color:#6B7280;vertical-align:top">Objeto</td><td style="padding:6px 0;font-size:12.5px;color:#6B7280">${objeto}</td></tr>` : ''}
          ${valor ? `<tr><td style="padding:6px 0;font-size:13px;color:#6B7280">Valor estimado</td><td style="padding:6px 0;font-size:13px;color:#2E2D2F;font-weight:700">${valor}</td></tr>` : ''}
          ${dataSessao ? `<tr><td style="padding:6px 0;font-size:13px;color:#6B7280">Data da sessão</td><td style="padding:6px 0;font-size:13px;color:#2E2D2F;font-weight:700">${dataSessao}</td></tr>` : ''}
          ${link ? `<tr><td style="padding:6px 0;font-size:13px;color:#6B7280">Link da licitação</td><td style="padding:6px 0;font-size:13px"><a href="${link}" style="color:#145653;font-weight:700">Acessar edital</a></td></tr>` : ''}
        </tbody>
      </table>
      ${analiseGeral ? `<p style="font-size:13px;color:#2E2D2F;font-weight:700;margin:0 0 14px;line-height:1.6">${analiseGeral}</p>` : ''}
      ${itensHtml ? `<div style="background:#F8FAFC;padding:14px;border-radius:8px;margin:0 0 14px">${itensHtml}</div>` : ''}
      ${observacao ? `<p style="font-size:13px;margin:0 0 6px;color:#374151;font-weight:700">Observações</p>
        <p style="font-size:12.5px;color:#2E2D2F;margin:0 0 14px">${observacao}</p>` : ''}
      ${anexos.length ? `<p style="font-size:13px;margin:0 0 6px;color:#374151;font-weight:700">Anexos</p>
        ${anexos.map(a => `<p style="margin:0 0 6px"><a href="${a.url}" style="color:#145653;font-weight:700;font-size:13px">📎 ${a.nome || 'Anexo'}</a></p>`).join('')}` : ''}
      <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center">Consultoria Athos Licita</p>
    </td></tr>
  </table></td></tr></table></body></html>`
}
