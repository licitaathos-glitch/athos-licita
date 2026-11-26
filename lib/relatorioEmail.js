// HTML do relatório para envio por e-mail — o mesmo conteúdo da tela (resumo,
// financeiro e uma ficha por licitação, agrupadas por fase), em tabelas com
// estilo inline, que é o que sobrevive a Gmail/Outlook (eles ignoram <style>).
import { brl, fichaDados, resumoPartes } from '@/lib/relatorio'

const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const COR_SIT = { ganho: '#16A34A', perdido: '#DC2626', pendente: '#94A3B8' }
const ROTULO_SIT = { ganho: 'Vencido', perdido: 'Perdido', pendente: 'Em andamento' }

const th = (t, a) => `<th style="background:#145653;color:#fff;padding:7px 8px;text-align:${a || 'left'};font-weight:700;font-size:10.5px">${t}</th>`
const td = (h, a) => `<td style="padding:6px 8px;border-bottom:1px solid #F1F5F9;font-size:11.5px;text-align:${a || 'left'};vertical-align:top">${h}</td>`

function tabela(cabecalhos, linhas) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 4px">
    <thead><tr>${cabecalhos.map(c => th(c.t, c.a)).join('')}</tr></thead><tbody>${linhas.join('')}</tbody></table>`
}

const kpi = (valor, rotulo) => `<td align="center" style="padding:12px 8px;background:#F8FAFC;border-radius:8px">
  <div style="font-size:20px;font-weight:800;color:#145653">${valor}</div>
  <div style="font-size:10.5px;color:#6B7280;text-transform:uppercase;letter-spacing:.03em;margin-top:2px">${rotulo}</div></td>`

// Os campos da ficha em duas colunas (rótulo pequeno em cima, valor embaixo)
function gradeCampos(campos) {
  const cel = ([k, v]) => `<td width="50%" style="padding:4px 10px 4px 0;vertical-align:top">
    <div style="font-size:9.5px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.04em">${esc(k)}</div>
    <div style="font-size:12.5px;color:#2E2D2F">${esc(v)}</div></td>`
  const linhas = []
  for (let i = 0; i < campos.length; i += 2) {
    linhas.push(`<tr>${cel(campos[i])}${campos[i + 1] ? cel(campos[i + 1]) : '<td></td>'}</tr>`)
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${linhas.join('')}</table>`
}

function fichaHtml(f, cor, faseNome) {
  const res = []
  res.push(`<div style="font-size:13px;font-weight:800;letter-spacing:.03em;color:${f.situacao.cor}">${esc(f.situacao.texto)}</div>`)
  if (f.homologada) res.push(`<div>Homologada em ${esc(f.homologada)}</div>`)
  if (f.motivo) res.push(`<div>Motivo: ${esc(f.motivo)}</div>`)
  if (f.nossoLance) res.push(`<div>Nosso lance: <strong>${brl(f.nossoLance)}</strong>${f.colocacao ? ` · ${esc(f.colocacao)}º lugar` : ''}</div>`)
  else if (f.colocacao) res.push(`<div>${esc(f.colocacao)}º lugar</div>`)
  if (f.vencedor) {
    res.push(f.vencedor.nome
      ? `<div>${esc(f.vencedor.nome)}${f.vencedor.valor ? ` · <strong>${brl(f.vencedor.valor)}</strong>` : ''}</div>`
      : `<div>1º colocado: <strong>${brl(f.vencedor.valor)}</strong></div>`)
  }
  if (f.valorVencido) res.push(`<div>Valor que vencemos: <strong style="color:#16A34A">${brl(f.valorVencido)}</strong></div>`)

  const itens = f.itens.length ? tabela(
    [{ t: 'Item' }, { t: 'Qtd.', a: 'right' }, { t: 'Colocação' }, { t: 'Situação' },
     { t: 'Vl. estimado', a: 'right' }, { t: 'Nosso valor mínimo', a: 'right' }, { t: 'Valor do 1º colocado', a: 'right' }],
    f.itens.map(it => `<tr style="${it.situacao === 'ganho' ? 'background:#DCFCE7' : ''}">
      ${td((it.numero !== '' ? `<strong>${esc(it.numero)} · </strong>` : '') + esc(it.descricao))}
      ${td(esc(it.quantidade || '—'), 'right')}
      ${td(it.colocacao ? it.colocacao + 'º' : '—')}
      ${td(`<span style="font-weight:700;color:${COR_SIT[it.situacao]}">${ROTULO_SIT[it.situacao]}</span>`)}
      ${td(it.estimado ? brl(it.estimado) : 'Sigiloso', 'right')}
      ${td(brl(it.nossoValor), 'right')}
      ${td((it.primeiro ? brl(it.primeiro) : '—') + (it.vencedorNome ? `<div style="color:#64748B">${esc(it.vencedorNome)}</div>` : ''), 'right')}
    </tr>`),
  ) : ''

  return `<div style="border:1px solid #E2E8F0;border-left:6px solid ${cor};border-radius:0 10px 10px 0;padding:14px 16px;margin:0 0 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
      <td style="font-size:14px;font-weight:800;color:#145653">${esc(f.titulo)}</td>
      <td align="right" style="white-space:nowrap"><span style="background:${cor};color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:4px 11px;border-radius:999px">${esc(faseNome)}</span></td>
    </tr></table>
    ${gradeCampos(f.campos)}
    ${f.link ? `<div style="margin-top:6px;font-size:12px"><a href="${esc(f.link)}" style="color:#145653;font-weight:700">Abrir licitação</a></div>` : ''}
    ${f.objeto ? `<p style="font-size:12.5px;color:#334155;margin:10px 0 0;line-height:1.55"><strong>Objeto:</strong> ${esc(f.objeto)}</p>` : ''}
    <div style="border-left:3px solid ${f.situacao.cor};background:#F8FAFC;border-radius:0 8px 8px 0;padding:9px 12px;margin-top:10px;font-size:12.5px;color:#334155;line-height:1.6">${res.join('')}</div>
    ${itens}
    ${f.observacoes ? `<div style="background:#FFFBEB;border-left:3px solid #B9A06B;border-radius:0 8px 8px 0;padding:8px 12px;margin-top:10px;font-size:12.5px;color:#2E2D2F;white-space:pre-wrap">
      <div style="font-size:9.5px;font-weight:700;color:#94A3B8;letter-spacing:.04em">OBSERVAÇÕES</div>${esc(f.observacoes)}</div>` : ''}
  </div>`
}

export function montarEmailRelatorio({ empresaNome, rotulo, fasesRotulo, rel, incluirFinanceiro = true }) {
  const resumo = resumoPartes(rel).map(p => p.negrito ? `<strong>${esc(p.texto)}</strong>` : esc(p.texto)).join('')
  let n = 1

  let financeiro = ''
  if (incluirFinanceiro && (rel.faturamento > 0 || rel.receita > 0)) {
    n++
    financeiro = `<h2 style="font-size:15px;color:#145653;margin:22px 0 10px">${n}. Resultado financeiro do período</h2>
      <table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom:10px"><tr>
        ${kpi(brl(rel.faturamento), 'Faturamento empenhado')}${kpi(rel.empenhos.length, 'Notas de empenho')}</tr></table>`
    if (rel.empenhos.length) {
      financeiro += tabela(
        [{ t: 'Nº Empenho' }, { t: 'Data' }, { t: 'Ata / Órgão' }, { t: 'Valor', a: 'right' }, { t: 'Situação' }],
        rel.empenhos.map(e => `<tr>${td(esc(e.numeroEmpenho))}${td(esc(e.dataEmpenho))}
          ${td(esc((e.numeroAta ? 'Ata ' + e.numeroAta + ' — ' : '') + e.orgao))}${td(brl(e.faturamento), 'right')}${td(esc(e.status))}</tr>`),
      )
    }
  }

  n++
  const grupos = rel.grupos.length
    ? rel.grupos.map(g => `
      <div style="background:${g.faixa.cor}1A;color:${g.faixa.cor};font-weight:800;font-size:15px;letter-spacing:.02em;padding:11px 16px;border-left:6px solid ${g.faixa.cor};border-radius:8px;margin:22px 0 10px">
        ${esc(g.faixa.nome.toUpperCase())}
        <span style="float:right;font-size:11.5px;font-weight:700">${g.licitacoes.length} ${g.licitacoes.length === 1 ? 'licitação' : 'licitações'}</span>
      </div>
      ${g.licitacoes.map(l => fichaHtml(fichaDados(l, { cotNums: rel.cotacoesPorLic.get(l.id) || [], faixaId: g.faixa.id }), g.faixa.cor, g.faixa.nome)).join('')}`).join('')
    : `<p style="font-size:13px;color:#6B7280">Nenhuma licitação nas fases e no período selecionados.</p>`

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3EFE7;font-family:-apple-system,sans-serif">
  <table width="100%"><tr><td align="center" style="padding:28px 14px">
  <table width="720" style="max-width:720px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#145653;padding:22px 26px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#B9A06B;letter-spacing:.1em">ATHOS LICITA</p>
      <p style="margin:6px 0 0;font-size:19px;font-weight:800;color:#fff">Relatório de Monitoramento de Licitações</p>
      <p style="margin:4px 0 0;font-size:13px;color:#E5E7EB">${esc(empresaNome)} · ${esc(rotulo)}</p>
    </td></tr>
    <tr><td style="padding:24px 26px">
      <h2 style="font-size:15px;color:#145653;margin:0 0 4px">1. Resumo do período</h2>
      <p style="font-size:11.5px;color:#94A3B8;margin:0 0 10px">Fases incluídas: ${esc(fasesRotulo)}</p>
      <p style="font-size:13px;color:#2E2D2F;line-height:1.6;margin:0 0 14px">${resumo}</p>
      <table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom:10px"><tr>
        ${kpi(rel.disputadas.length, 'Participadas')}${kpi(rel.ganhas.length, 'Vencidas')}
        ${kpi(rel.perdidas.length, 'Perdidas')}${kpi(rel.emAndamento.length, 'Em andamento')}</tr></table>
      ${financeiro}
      <h2 style="font-size:15px;color:#145653;margin:22px 0 0">${n}. Licitações por fase</h2>
      ${grupos}
      <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;text-align:center;border-top:1px solid #F1F5F9;padding-top:16px">
        Athos Licita · Consultoria em Licitações Públicas · Lei 14.133/2021<br />
        licitacoes@athoslicita.com · (21) 99763-9451 · @athoslicita
      </p>
    </td></tr>
  </table></td></tr></table></body></html>`
}
