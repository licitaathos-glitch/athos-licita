import { diasRestantes } from './datas'
import { temValidade } from './tiposCertidao'
import { FASES, normalizarFase } from './fases'

// ── Certidões vencendo nos próximos N dias (ou já vencidas) ───
export function certidoesEmAlerta(documentos, empresasPorId, dias = 7) {
  return documentos
    .filter(d => d.id && temValidade(d.tipo_slug))
    .map(d => ({ ...d, dd: diasRestantes(d.validade) }))
    .filter(d => d.dd !== null && d.dd <= dias)
    .map(d => ({
      empresaId: String(d.empresa_id || '').trim(),
      empresaNome: empresasPorId[String(d.empresa_id || '').trim()] || '',
      tipo: d.tipo_slug, validade: d.validade, dias: d.dd,
    }))
}

// ── Atas vencendo nos próximos N dias ──────────────────────────
export function atasEmAlerta(atas, dias = 30) {
  return atas
    .filter(a => a.id)
    .map(a => ({ ...a, dd: diasRestantes(a.vencimento) }))
    .filter(a => a.dd !== null && a.dd <= dias)
    .map(a => ({
      empresaId: String(a.empresaId || '').trim(),
      empresaNome: a.empresaNome || '', numeroAta: a.numeroAta,
      orgao: a.orgao, vencimento: a.vencimento, dias: a.dd,
    }))
}

// ── Licitações com sessão de disputa amanhã ────────────────────
export function sessoesAmanha(licitacoes) {
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(0, 0, 0, 0)
  const depois = new Date(amanha); depois.setDate(depois.getDate() + 1)

  const paraData = v => {
    const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null
  }

  return licitacoes
    .filter(l => l.id && !['Finalizada', 'Descartado'].includes(normalizarFase(l.fase || 'Em analise')))
    .map(l => {
      const d = paraData(l.dataSessao) || paraData(l.dataLimite) || paraData(l.dataAbertura)
      return { l, d }
    })
    .filter(({ d }) => d && d >= amanha && d < depois)
    .map(({ l }) => ({
      empresaId: String(l.empresaId || '').trim(), empresaNome: l.empresaNome || '',
      numeroEdital: l.numeroEdital, objeto: l.objeto, orgao: l.orgao,
      fase: FASES.find(f => f.id === normalizarFase(l.fase))?.nome || 'Em análise',
      data: l.dataSessao || l.dataLimite || l.dataAbertura,
    }))
}

// ── Monta o e-mail HTML do dia para uma empresa ────────────────
export function montarEmailDiario({ empresaNome, certidoes, atas, sessoes, oportunidades, erroOportunidades }) {
  const secao = (titulo, cor, linhas) => !linhas.length ? '' : `
    <tr><td style="padding:18px 26px 6px">
      <p style="margin:0 0 10px;font-size:13px;font-weight:800;color:${cor};text-transform:uppercase;letter-spacing:.4px">${titulo} (${linhas.length})</p>
      ${linhas.join('')}
    </td></tr>`

  const linhaCert = c => `<div style="padding:7px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#374151">
    <strong>${c.tipo}</strong> — ${c.dias < 0 ? 'vencida há ' + Math.abs(c.dias) + 'd' : c.dias === 0 ? 'vence hoje' : 'vence em ' + c.dias + 'd'} (${c.validade})
  </div>`
  const linhaAta = a => `<div style="padding:7px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#374151">
    <strong>Ata ${a.numeroAta}</strong> — ${a.orgao || ''} — ${a.dias < 0 ? 'vencida há ' + Math.abs(a.dias) + 'd' : 'vence em ' + a.dias + 'd'} (${a.vencimento})
  </div>`
  const linhaSessao = s => `<div style="padding:7px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#374151">
    <strong>${s.numeroEdital || 'Licitação'}</strong> — ${s.orgao || ''} — ${s.data} — <span style="color:#7C3AED">${s.fase}</span>
  </div>`
  const linhaOp = o => `<div style="padding:9px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#374151">
    <strong>${(o.objeto || '').slice(0, 100)}</strong><br>
    <span style="font-size:11.5px;color:#6B7280">${o.orgao || ''}${o.uf ? '/' + o.uf : ''} · ${o.valor || 'valor não informado'}${o.dataLimite ? ' · propostas até ' + o.dataLimite : ''}</span>
  </div>`

  const total = certidoes.length + atas.length + sessoes.length + oportunidades.length
  if (!total && !erroOportunidades) return null

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,sans-serif">
  <table width="100%"><tr><td align="center" style="padding:28px 14px">
  <table width="600" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#1B2E4B;padding:22px 26px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:.1em">ATHOS LICITA — ALERTA DIÁRIO</p>
      <p style="margin:6px 0 0;font-size:19px;font-weight:800;color:#fff">${empresaNome}</p>
    </td></tr>
    ${secao('⚠️ Certidões vencendo', '#B45309', certidoes.map(linhaCert))}
    ${secao('🗂️ Atas vencendo', '#0F766E', atas.map(linhaAta))}
    ${secao('🎯 Sessões de disputa amanhã', '#7C3AED', sessoes.map(linhaSessao))}
    ${secao('🔎 Novas oportunidades no PNCP', '#1D4ED8', oportunidades.map(linhaOp))}
    ${erroOportunidades ? `<tr><td style="padding:12px 26px 0"><p style="font-size:11.5px;color:#9CA3AF;margin:0">A busca de novas oportunidades não pôde ser concluída hoje (${erroOportunidades}). O restante do alerta segue normal.</p></td></tr>` : ''}
    <tr><td style="padding:20px 26px">
      <a href="https://athos-licita.vercel.app/dashboard" style="display:inline-block;background:#C9A84C;color:#1B2E4B;font-weight:800;font-size:13px;padding:10px 22px;border-radius:9px;text-decoration:none">Abrir a plataforma</a>
      <p style="margin:16px 0 0;font-size:11px;color:#9CA3AF">Consultoria Athos Licita</p>
    </td></tr>
  </table></td></tr></table></body></html>`
}
