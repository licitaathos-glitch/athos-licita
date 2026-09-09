// HTML do relatório mensal para envio por e-mail — mesmo conteúdo das 4
// seções da tela (app/dashboard/relatorio/page.js), mas em layout de
// tabelas com estilo inline, do jeito que sobrevive a clientes de e-mail
// (Gmail, Outlook etc, que ignoram <style> em bloco e CSS externo).
import { nomeResultado, corResultado } from '@/lib/resultado'
import { faseDe } from '@/lib/fases'
import { dataRef, statusRelatorio, valorVencidoItem, valorNossoTotal, valorEstimadoTotal, brl } from '@/lib/relatorio'

const th = (texto, alinhar) => `<th style="background:#145653;color:#fff;padding:8px 10px;text-align:${alinhar || 'left'};font-weight:700;font-size:11px">${texto}</th>`
const td = (html, alinhar) => `<td style="padding:7px 10px;border-bottom:1px solid #F1F5F9;font-size:12px;text-align:${alinhar || 'left'};vertical-align:top">${html}</td>`

function tabela(cabecalhos, linhasHtml) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px">
    <thead><tr>${cabecalhos.map(c => th(c.texto, c.alinhar)).join('')}</tr></thead>
    <tbody>${linhasHtml.join('')}</tbody>
  </table>`
}

function linhaFaseSeparadora(fx, colspan) {
  return `<tr><td colspan="${colspan}" style="background:${fx.cor}1A;color:${fx.cor};font-weight:700;font-size:11.5px;padding:7px 10px">${fx.nome.toUpperCase()}</td></tr>`
}

export function montarEmailRelatorio({ empresaNome, rotuloMes, rel }) {
  const resumoTexto = `Em ${rotuloMes}, participamos de <strong>${rel.disputadas.length}</strong> licitaç${rel.disputadas.length === 1 ? 'ão' : 'ões'} com resultado definido: vencemos <strong>${rel.ganhas.length}</strong> e perdemos <strong>${rel.perdidas.length}</strong>${rel.disputadas.length > 0 ? ` (taxa de sucesso de <strong>${rel.taxa.toFixed(0)}%</strong>)` : ''}.${rel.naoParticipamos.length > 0 ? ` Decidimos não participar de <strong>${rel.naoParticipamos.length}</strong> oportunidade${rel.naoParticipamos.length === 1 ? '' : 's'} analisada${rel.naoParticipamos.length === 1 ? '' : 's'}.` : ''} Além disso, <strong>${rel.aguardando.length}</strong> licitaç${rel.aguardando.length === 1 ? 'ão segue' : 'ões seguem'} em andamento.`

  const kpi = (valor, rotulo) => `<td align="center" style="padding:12px 8px;background:#F8FAFC;border-radius:8px">
    <div style="font-size:20px;font-weight:800;color:#145653">${valor}</div>
    <div style="font-size:10.5px;color:#6B7280;text-transform:uppercase;letter-spacing:.03em;margin-top:2px">${rotulo}</div>
  </td>`
  const kpisResumo = `<table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom:18px"><tr>
    ${kpi(rel.disputadas.length, 'Participadas')}
    ${kpi(rel.ganhas.length, 'Vencidas')}
    ${kpi(rel.perdidas.length, 'Perdidas')}
    ${kpi(rel.aguardando.length, 'Em andamento')}
  </tr></table>`

  let financeiroHtml = ''
  if (rel.faturamento > 0 || rel.receita > 0) {
    financeiroHtml = `<h2 style="font-size:15px;color:#145653;margin:22px 0 10px">2. Resultado financeiro do período</h2>
      <table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom:14px"><tr>
        ${kpi(brl(rel.faturamento), 'Faturamento empenhado')}
        ${kpi(rel.empenhos.length, 'Notas de empenho')}
      </tr></table>`
    if (rel.empenhos.length > 0) {
      financeiroHtml += tabela(
        [{ texto: 'Nº Empenho' }, { texto: 'Data' }, { texto: 'Ata / Órgão' }, { texto: 'Valor', alinhar: 'right' }, { texto: 'Situação' }],
        rel.empenhos.map(e => `<tr>
          ${td(e.numeroEmpenho)}${td(e.dataEmpenho)}
          ${td((e.numeroAta ? 'Ata ' + e.numeroAta + ' — ' : '') + e.orgao)}
          ${td(brl(e.faturamento), 'right')}${td(e.status)}
        </tr>`)
      )
    }
  }

  let licitacoesHtml = ''
  if (rel.todasNoRelatorio.length > 0) {
    const linhas = []
    let faseAnterior = null
    rel.todasNoRelatorio.forEach(l => {
      const fx = faseDe(l.fase || 'Em analise')
      if (fx.id !== faseAnterior) { linhas.push(linhaFaseSeparadora(fx, 9)); faseAnterior = fx.id }
      const nosso = valorNossoTotal(l)
      const estimado = valorEstimadoTotal(l)
      const cotNums = rel.cotacoesPorLic.get(l.id) || []
      const bg = l.resultado === 'Ganhamos' ? 'background:#DCFCE7' : ''
      linhas.push(`<tr style="${bg}">
        ${td((dataRef(l) || '').split(' ')[0] || '—')}
        ${td(l.portal || '—')}
        ${td(`<strong>${l.numeroEdital || 'Sem nº'}</strong>${l.orgao ? ' - ' + l.orgao : ''}${l.uasg ? ' (UASG ' + l.uasg + ')' : ''}${l.objeto ? `<div style="color:#64748B;font-weight:400">${l.objeto}</div>` : ''}`)}
        ${td(l.uf || '—')}
        ${td(`<span style="font-weight:700;color:${corResultado(l.resultado)}">${statusRelatorio(l)}</span>`)}
        ${td(cotNums.length ? cotNums.join(', ') : '—')}
        ${td(estimado ? brl(estimado) : '—', 'right')}
        ${td(nosso ? brl(nosso) : '—', 'right')}
        ${td(l.motivo || l.observacaoDisputa || '—')}
      </tr>`)
    })
    licitacoesHtml = `<h2 style="font-size:15px;color:#145653;margin:22px 0 10px">3. Licitações do período</h2>` +
      tabela(
        [{ texto: 'Data' }, { texto: 'Portal' }, { texto: 'Edital / Objeto' }, { texto: 'UF' }, { texto: 'Status' },
         { texto: 'Nº cotação' }, { texto: 'Vl. estimado', alinhar: 'right' }, { texto: 'Nosso valor', alinhar: 'right' }, { texto: 'Observações' }],
        linhas,
      )
  }

  let itensHtml = ''
  if (rel.comDetalheItens.length > 0) {
    const blocos = rel.comDetalheItens.map(l => {
      const itensParticipando = (l.itens || []).filter(it => it.participar)
      let corpo
      if (itensParticipando.length > 0) {
        corpo = tabela(
          [{ texto: 'Item' }, { texto: 'Colocação' }, { texto: 'Situação' }, { texto: 'Vl. estimado', alinhar: 'right' },
           { texto: 'Nosso valor mínimo', alinhar: 'right' }, { texto: 'Valor do 1º colocado', alinhar: 'right' }],
          itensParticipando.map(it => {
            const colocacao = Number(it.colocacao) || null
            const venceuItem = colocacao === 1 || (!colocacao && l.resultado === 'Ganhamos')
            const nossoValor = valorVencidoItem(it)
            const valor1oColocado = venceuItem ? nossoValor : (Number(it.vencedorPreco) || null)
            const bg = venceuItem ? 'background:#DCFCE7' : ''
            return `<tr style="${bg}">
              ${td(it.descricao)}
              ${td(colocacao ? colocacao + 'º' : '—')}
              ${td(`<span style="font-weight:700;color:${venceuItem ? '#16A34A' : '#DC2626'}">${venceuItem ? 'Vencido' : 'Perdido'}</span>`)}
              ${td(it.valorUnitarioRef ? brl(it.valorUnitarioRef) : 'Sigiloso', 'right')}
              ${td(brl(nossoValor), 'right')}
              ${td((valor1oColocado ? brl(valor1oColocado) : '—') + (it.vencedorNome && !venceuItem ? `<div style="font-weight:400;color:#64748B">${it.vencedorNome}</div>` : ''), 'right')}
            </tr>`
          }),
        )
      } else {
        const partes = []
        if (l.valor) partes.push(`Valor estimado: <strong>${l.valor}</strong>`)
        if (l.nossoLance) partes.push(`Nosso valor mínimo: <strong>${brl(l.nossoLance)}</strong>`)
        if (l.valorVencedor) partes.push(`Valor do 1º colocado: <strong>${brl(l.valorVencedor)}</strong>${l.empresaVencedora ? ' (' + l.empresaVencedora + ')' : ''}`)
        if (l.colocacao) partes.push(`Nossa colocação: ${l.colocacao}º`)
        corpo = `<p style="font-size:12.5px;color:#374151;margin:0 0 14px">${partes.length ? partes.join(' · ') : '<span style="color:#94A3B8">Sem itens marcados como participando nem valores de lance registrados nesta licitação.</span>'}</p>`
      }
      return `<div style="border-left:3px solid ${corResultado(l.resultado)};padding-left:12px;margin-bottom:16px">
        <p style="margin:0 0 2px;font-size:13.5px;font-weight:700;color:#2E2D2F">
          ${l.numeroEdital || 'Sem nº'} — ${l.orgao}${l.uf ? '/' + l.uf : ''}
          <span style="color:${corResultado(l.resultado)};margin-left:8px">${nomeResultado(l.resultado)}</span>
        </p>
        <p style="margin:0 0 8px;font-size:12px;color:#6B7280">${l.modalidade || ''}${l.portal ? ' · ' + l.portal : ''}${dataRef(l) ? ' · sessão em ' + dataRef(l).split(' ')[0] : ''}</p>
        ${corpo}
        ${l.observacaoDisputa ? `<p style="font-size:12px;color:#374151;margin:-8px 0 12px">${l.observacaoDisputa}</p>` : ''}
      </div>`
    })
    itensHtml = `<h2 style="font-size:15px;color:#145653;margin:22px 0 10px">4. Detalhamento por item — vitórias e derrotas</h2>${blocos.join('')}`
  }

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3EFE7;font-family:-apple-system,sans-serif">
  <table width="100%"><tr><td align="center" style="padding:28px 14px">
  <table width="720" style="max-width:720px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#145653;padding:22px 26px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#B9A06B;letter-spacing:.1em">ATHOS LICITA</p>
      <p style="margin:6px 0 0;font-size:19px;font-weight:800;color:#fff">Relatório de Monitoramento de Licitações</p>
      <p style="margin:4px 0 0;font-size:13px;color:#E5E7EB">${empresaNome} · ${rotuloMes}</p>
    </td></tr>
    <tr><td style="padding:24px 26px">
      <h2 style="font-size:15px;color:#145653;margin:0 0 10px">1. Resumo do período</h2>
      <p style="font-size:13px;color:#2E2D2F;line-height:1.6;margin:0 0 14px">${resumoTexto}</p>
      ${kpisResumo}
      ${financeiroHtml}
      ${licitacoesHtml}
      ${itensHtml}
      <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;text-align:center;border-top:1px solid #F1F5F9;padding-top:16px">
        Athos Licita · Consultoria em Licitações Públicas · Lei 14.133/2021<br />
        licita.athos@gmail.com · (21) 99763-9451 · @athoslicita
      </p>
    </td></tr>
  </table></td></tr></table></body></html>`
}
