import { NextResponse } from 'next/server'
import { getUsuarioFromReq, podeAcessarMenu } from '@/lib/auth'
import { chamarGAS } from '@/lib/gas'

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

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })

  const b = await req.json()
  const { empresaNome, numeroEdital, objeto, link, dataSessao, srp, destinatarioEmail } = b
  if (!destinatarioEmail) return NextResponse.json({ sucesso: false, erro: 'Informe o e-mail de destino.' })

  const dataProposta = doisDiasAntes(dataSessao)
  const html = montarEmailAviso({ empresaNome, numeroEdital, objeto, link, dataSessao, dataProposta, srp })

  try {
    const env = await chamarGAS({
      action: 'enviarEmailGenerico',
      para: destinatarioEmail,
      assunto: `Nova oportunidade — ${numeroEdital || 'licitação'} — avaliar viabilidade`,
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

function montarEmailAviso({ empresaNome, numeroEdital, objeto, link, dataSessao, dataProposta, srp }) {
  const linhaSRP = srp === 'Sim'
    ? 'Trata-se de Sistema de Registro de Preços (SRP).'
    : 'Não se trata de registro de preços.'

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3EFE7;font-family:-apple-system,sans-serif">
  <table width="100%"><tr><td align="center" style="padding:28px 14px">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#145653;padding:22px 26px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#B9A06B;letter-spacing:.1em">ATHOS LICITA</p>
      <p style="margin:6px 0 0;font-size:19px;font-weight:800;color:#fff">Nova oportunidade identificada</p>
    </td></tr>
    <tr><td style="padding:24px 26px">
      <p style="font-size:14px;color:#2E2D2F;margin:0 0 14px">
        Prezados,<br /><br />
        Identifiquei uma licitação na qual há possibilidade de participação pela <strong>${empresaNome || ''}</strong>. ${linhaSRP}<br /><br />
        Encaminho o edital para que possam avaliar a viabilidade de participação.
      </p>
      <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
        <tbody>
          ${link ? `<tr><td style="padding:8px 0;font-size:13px;color:#6B7280;width:170px">Link da licitação</td><td style="padding:8px 0;font-size:13px"><a href="${link}" style="color:#145653;font-weight:700">Acessar edital</a></td></tr>` : ''}
          <tr><td style="padding:8px 0;font-size:13px;color:#6B7280">Objeto</td><td style="padding:8px 0;font-size:13px;color:#2E2D2F">${objeto || '—'}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#6B7280">Data da sessão</td><td style="padding:8px 0;font-size:13px;color:#2E2D2F;font-weight:700">${dataSessao || '—'}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#6B7280">Data para apresentar proposta</td><td style="padding:8px 0;font-size:13px;color:#2E2D2F;font-weight:700">${dataProposta || '—'}</td></tr>
        </tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center">Consultoria Athos Licita</p>
    </td></tr>
  </table></td></tr></table></body></html>`
}
