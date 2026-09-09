// Lógica de cálculo do relatório mensal — extraída da tela
// (app/dashboard/relatorio/page.js) pra ser usada também no envio por
// e-mail (lib/relatorioEmail.js), sem duplicar as regras em dois lugares.
import { mesDe } from '@/lib/resultado'
import { faseDe, FASES } from '@/lib/fases'

export const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
export const brl = v => v ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'

// Data que de fato representa "quando" a licitação acontece: a sessão, se
// já tiver sido ajustada; senão o limite da proposta; senão a abertura.
// Nunca usar dataAbertura sozinha — ela só marca o início do prazo.
export const dataRef = l => l.dataSessao || l.dataLimite || l.dataAbertura

// Rótulo de status pro relatório, no mesmo espírito da planilha do Adriano
// (VENCEDOR, PERDIDA, NÃO PARTICIPAÇÃO, PARTICIPAR...)
export const statusRelatorio = l => {
  if (l.resultado === 'Ganhamos') return 'VENCEDOR'
  if (['Perdemos', 'Desclassificados'].includes(l.resultado)) return 'PERDIDA'
  if (l.resultado === 'Nao participamos') return 'NÃO PARTICIPAÇÃO'
  if (l.resultado === 'Deserta') return 'DESERTA/FRACASSADA'
  if (l.resultado === 'Cancelada') return 'CANCELADA/SUSPENSA'
  return 'PARTICIPAR'
}

// Valor com que efetivamente disputamos um item (ganhando ou perdendo): o
// lance final registrado na fase "Finalizada", ou o valor mínimo proposto
// (convertendo % de desconto pro preço equivalente, quando for o caso).
export const valorVencidoItem = it => {
  if (it.lanceFinal) return Number(it.lanceFinal) || 0
  const estimado = Number(it.valorUnitarioRef) || 0
  const v = Number(it.meuValor) || 0
  return it.formaValor === 'desconto' ? estimado * (1 - v / 100) : v
}

// Valor da nossa proposta pra licitação inteira — soma dos itens
// participando quando há itens cadastrados, senão o campo único de lance
// (nossoLance), usado tanto pra vitórias quanto pra derrotas.
export const valorNossoTotal = l => {
  const marcados = (l.itens || []).filter(it => it.participar)
  if (marcados.length) {
    return marcados.reduce((s, it) => s + (Number(it.quantidade) || 0) * valorVencidoItem(it), 0)
  }
  return Number(l.nossoLance) || 0
}

// Valor estimado só dos itens em que vamos/fomos participar — quando há
// itens cadastrados. Sem itens, usa o campo único "valor" da licitação.
export const valorEstimadoTotal = l => {
  const marcados = (l.itens || []).filter(it => it.participar)
  if (marcados.length) {
    return marcados.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valorUnitarioRef) || 0), 0)
  }
  return Number(String(l.valor || '').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
}

// Monta o objeto "rel" completo do relatório mensal de uma empresa — usado
// tanto pela tela quanto pelo e-mail. lics/empenhos/cotacoes vêm sem filtro
// de empresa (como devolvidos pelas APIs); a função filtra por empresaSel.
export function calcularRelatorio({ lics: todasLics, empenhos: todosEmpenhos, cotacoes, empresaSel, mes }) {
  const todasDaEmpresa = todasLics.filter(l => l.empresa_id === empresaSel)
  const empenhos = todosEmpenhos.filter(e => e.empresa_id === empresaSel && mesDe(e.dataEmpenho) === mes)

  // Nº de cotação de fornecedor por licitação — uma licitação pode ter
  // pedido cotação a mais de um fornecedor; junta os números preenchidos.
  const cotacoesPorLic = new Map()
  ;(cotacoes || []).forEach(c => {
    if (!c.numeroCotacaoFornecedor) return
    const lista = cotacoesPorLic.get(c.licitacaoId) || []
    lista.push(c.numeroCotacaoFornecedor)
    cotacoesPorLic.set(c.licitacaoId, lista)
  })

  const comDesfecho = l => l.resultado && l.resultado !== 'Aguardando'

  // Para quem já tem desfecho, o mês do relatório é definido pela DATA DE
  // HOMOLOGAÇÃO (é o campo que a própria tela de Andamento explica: "é o
  // mês em que a licitação entra no relatório, não o mês em que foi
  // aberta"). Só cai pra sessão/limite/abertura se não tiver homologação
  // registrada (ex: "Não participamos", que não passa por homologação).
  const mesDoDesfecho = l => mesDe(l.dataHomologacao) || mesDe(dataRef(l))

  // "Oportunidades analisadas" = o que teve desfecho neste mês (pela
  // homologação) + o que ainda está pendente com sessão/limite/abertura
  // neste mês — ou seja, todo mundo que fez parte do trabalho do mês.
  const decididasNoMes = todasDaEmpresa.filter(l => comDesfecho(l) && mesDoDesfecho(l) === mes)
  const pendentesNoMes = todasDaEmpresa.filter(l => !comDesfecho(l) && mesDe(dataRef(l)) === mes)
  const lics = [...decididasNoMes, ...pendentesNoMes]

  // O "em andamento" mostra o que ainda está sem desfecho até o último dia
  // do mês do relatório (olhando pra trás) — nunca usa a data de hoje,
  // porque o relatório pode ser gerado bem depois do mês em questão. Isso
  // deixa de fora sessões futuras já agendadas além do mês do relatório.
  const aguardando = todasDaEmpresa.filter(l => {
    if (comDesfecho(l)) return false
    const m = mesDe(dataRef(l))
    return !m || m <= mes
  })

  const disputadas = lics.filter(l => ['Ganhamos', 'Perdemos', 'Desclassificados'].includes(l.resultado))
  const ganhas = lics.filter(l => l.resultado === 'Ganhamos')
  const perdidas = lics.filter(l => ['Perdemos', 'Desclassificados'].includes(l.resultado))
  const naoParticipamos = lics.filter(l => l.resultado === 'Nao participamos')

  const taxa = disputadas.length ? (ganhas.length / disputadas.length) * 100 : 0

  // Lista única pro relatório: tudo que entrou no mês (decididas + pendentes
  // do mês) mais o que ficou em andamento de meses anteriores — sem repetir,
  // ordenado por data (mais antiga primeiro), do jeito que vai pro cliente.
  const porId = new Map()
  ;[...lics, ...aguardando].forEach(l => porId.set(l.id, l))

  // Reorganizado por fase (ordem do fluxo: Em análise → ... → Finalizada →
  // Descartado), e dentro de cada fase por data — continua sendo UMA
  // tabela só, com um separador visual entre fases, sem virar tabelas soltas.
  const ordemFase = FASES.map(f => f.id)
  // A tabela de "licitações do período" mostra tudo que ainda não foi
  // disputado (Em análise, Inscrição, Aguardando, Descartado). As
  // "Finalizada" saem daqui pra não repetir o que já é mostrado com
  // detalhe no detalhamento por item.
  const todasNoRelatorio = [...porId.values()]
    .filter(l => faseDe(l.fase || 'Em analise').id !== 'Finalizada')
    .sort((a, b) => {
      const ia = ordemFase.indexOf(faseDe(a.fase || 'Em analise').id)
      const ib = ordemFase.indexOf(faseDe(b.fase || 'Em analise').id)
      if (ia !== ib) return ia - ib
      const da = dataRef(a).split(' ')[0].split('/').reverse().join('') || '00000000'
      const db = dataRef(b).split(' ')[0].split('/').reverse().join('') || '00000000'
      return da.localeCompare(db)
    })

  // Licitações com detalhe item a item de vitória/derrota: qualquer
  // disputada (ganhamos, perdemos ou desclassificados) que tenha itens
  // marcados como participando.
  const comDetalheItens = disputadas.filter(l => (l.itens || []).some(it => it.participar))

  return {
    lics, disputadas, ganhas, perdidas, naoParticipamos, aguardando, todasNoRelatorio,
    comDetalheItens, cotacoesPorLic,
    taxa,
    faturamento: empenhos.reduce((s, e) => s + e.faturamento, 0),
    receita: empenhos.reduce((s, e) => s + e.receita, 0),
    empenhos,
  }
}
