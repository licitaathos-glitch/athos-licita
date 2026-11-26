// Lógica do relatório — compartilhada entre a tela (app/dashboard/relatorio),
// o PDF (impressão da própria tela) e o e-mail (lib/relatorioEmail.js), para as
// regras existirem em um lugar só.
//
// O relatório é organizado pelas MESMAS faixas da lista de licitações
// (lib/fases.js → ABAS_LISTA): Em análise, Inscrição de proposta, Aguardando
// disputa, Licitações do dia, Disputa, Suspensas, Finalizada, Descartado e
// Excluída. Cada licitação vira uma ficha dentro da faixa em que ela aparece.
import { corResultado } from '@/lib/resultado'
import { faseDe, faixaDe, ABAS_LISTA, hojeBR } from '@/lib/fases'

export const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
export const brl = v => v ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'

// ── Faixas selecionáveis ────────────────────────────────────────────────────
export const FAIXAS = ABAS_LISTA
// Excluída fica de fora por padrão: é a licitação que saiu da lista principal.
export const FAIXAS_PADRAO = FAIXAS.filter(f => f.id !== 'Excluida').map(f => f.id)
// Faixas "vivas": só nelas o que ficou pendente de períodos anteriores é trazido
// para o relatório (Descartado e Excluída não são "em andamento").
const FAIXAS_ATIVAS = ['Em analise', 'Inscricao', 'Aguardando', 'Dia', 'Disputa', 'Suspensas']

// ── Datas e números ─────────────────────────────────────────────────────────
// "dd/mm/aaaa [hh:mm]" → "aaaa-mm-dd" (comparável como texto). '' se não houver data.
export const isoDe = dataBR => {
  const m = String(dataBR || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
export const brDeISO = iso => String(iso || '').split('-').reverse().join('/')

// Primeiro e último dia de um mês "aaaa-mm", no formato dos campos de data
export function mesPeriodo(ym) {
  const [a, m] = String(ym).split('-')
  const ultimo = new Date(Number(a), Number(m), 0).getDate()
  return { de: `${a}-${m}-01`, ate: `${a}-${m}-${String(ultimo).padStart(2, '0')}` }
}

// "novembro de 2026" quando o período é um mês inteiro; senão "01/11/2026 a 15/11/2026"
export function rotuloPeriodo(de, ate) {
  if (de && ate) {
    const mes = mesPeriodo(de.slice(0, 7))
    if (mes.de === de && mes.ate === ate) return `${MESES[Number(de.slice(5, 7)) - 1]} de ${de.slice(0, 4)}`
    return `${brDeISO(de)} a ${brDeISO(ate)}`
  }
  if (de) return `a partir de ${brDeISO(de)}`
  if (ate) return `até ${brDeISO(ate)}`
  return 'todo o histórico'
}

// Número em texto brasileiro ("R$ 10.993.518,20") ou com ponto decimal ("1234.56")
export function numBR(v) {
  const s = String(v ?? '').replace(/[^\d.,-]/g, '')
  if (!s) return 0
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : (s.split('.').length > 2 ? Number(s.replace(/\./g, '')) : Number(s))
  return Number.isFinite(n) ? n : 0
}

// Data que de fato representa "quando" a licitação acontece: a sessão, se
// já tiver sido ajustada; senão o limite da proposta; senão a abertura.
// Nunca usar dataAbertura sozinha — ela só marca o início do prazo.
export const dataRef = l => l.dataSessao || l.dataLimite || l.dataAbertura || ''

// ── Valores ─────────────────────────────────────────────────────────────────
// Rótulo de situação quando já há resultado (mesmo espírito da planilha do Adriano)
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

const participando = l => (l.itens || []).filter(it => it.participar)

// Valor da nossa proposta pra licitação inteira — soma dos itens
// participando quando há itens cadastrados, senão o campo único de lance.
export const valorNossoTotal = l => {
  const marcados = participando(l)
  if (marcados.length) {
    return marcados.reduce((s, it) => s + (Number(it.quantidade) || 0) * valorVencidoItem(it), 0)
  }
  return Number(l.nossoLance) || 0
}

// Resultado de um item — mesma regra da tela de Andamento (ModalStatus):
// colocação 1 é nosso; qualquer outra colocação (ou concorrente registrado)
// foi perdido; sem nada preenchido, vale o resultado geral da licitação.
export const resultadoItem = (it, l) => {
  const col = Number(it.colocacao) || null
  if (col === 1) return 'ganho'
  if (col || String(it.vencedorNome || '').trim()) return 'perdido'
  if (l.resultado === 'Ganhamos') return 'ganho'
  if (['Perdemos', 'Desclassificados', 'Deserta', 'Cancelada'].includes(l.resultado)) return 'perdido'
  return 'pendente'
}

// Preço do 1º colocado do item: se o item é nosso, é o nosso próprio valor;
// senão, o preço vencedor que foi preenchido no item.
export const valor1oColocadoItem = (it, l) =>
  resultadoItem(it, l) === 'ganho' ? valorVencidoItem(it) : (Number(it.vencedorPreco) || null)

// Valor que vencemos: soma dos itens ganhos (ou o lance geral, se a licitação
// não tem itens e foi ganha)
export function valorVencidoTotal(l) {
  const part = participando(l)
  if (part.length) {
    const s = part.filter(it => resultadoItem(it, l) === 'ganho')
      .reduce((t, it) => t + (Number(it.quantidade) || 0) * valorVencidoItem(it), 0)
    return s || null
  }
  return l.resultado === 'Ganhamos' ? (Number(l.nossoLance) || null) : null
}

// Há alguma informação de resultado/vencedor preenchida (no item ou no geral)?
export const temInfoVencedor = l =>
  !!(l.valorVencedor || l.empresaVencedora || l.colocacao ||
    participando(l).some(it => it.vencedorPreco || it.vencedorNome || it.colocacao))

const comDesfecho = l => !!l.resultado && l.resultado !== 'Aguardando'

// ── Situação (a linha em destaque da ficha) ─────────────────────────────────
// Com resultado: o resultado. Sem resultado: onde a licitação está. Na Disputa
// (lances, habilitação e documentos) o rótulo é "EM JULGAMENTO".
const SITUACAO_POR_FAIXA = {
  'Em analise': 'EM ANÁLISE', 'Inscricao': 'INSCRIÇÃO DE PROPOSTA', 'Aguardando': 'AGUARDANDO DISPUTA',
  'Dia': 'LICITAÇÃO DO DIA', 'Disputa': 'EM JULGAMENTO', 'Suspensas': 'SUSPENSA',
  'Finalizada': 'FINALIZADA', 'Descartado': 'DESCARTADA', 'Excluida': 'EXCLUÍDA',
}
export function situacaoLicitacao(l, faixaId) {
  const faixa = FAIXAS.find(f => f.id === faixaId)
  if (faixaId !== 'Excluida' && comDesfecho(l)) return { texto: statusRelatorio(l), cor: corResultado(l.resultado) }
  return { texto: SITUACAO_POR_FAIXA[faixaId] || String(faixaId).toUpperCase(), cor: faixa?.cor || '#64748B' }
}

// ── A ficha: tudo que se mostra de uma licitação, já pronto para a tela e o e-mail
export function fichaDados(l, { cotNums = [], faixaId }) {
  const part = participando(l)
  const estimado = numBR(l.valor)
  const valorTxt = estimado ? brl(estimado) : (l.valor || '')

  const campos = [
    ['Órgão', l.orgao], ['UASG', l.uasg], ['UF', l.uf], ['Modalidade', l.modalidade], ['Portal', l.portal],
    ['Nº PNCP', l.numeroPNCP], ['Valor estimado', valorTxt],
    ['Abertura', l.dataAbertura], ['Limite da proposta', l.dataLimite], ['Sessão de disputa', l.dataSessao],
    ['SRP', l.srp],
    ['Nº proposta', l.numeroProposta], ['Nº cotação', cotNums.join(', ')],
  ].filter(([, v]) => String(v ?? '').trim()).map(([k, v]) => [k, String(v).trim()])

  const nosso = valorNossoTotal(l)
  const venceu = Number(l.valorVencedor) || 0

  // Itens: só quando já houve disputa/resultado/vencedor registrado — antes
  // disso a lista de itens é de trabalho, não de relatório.
  const faseId = faseDe(l.fase || 'Em analise').id
  const mostrarItens = part.length > 0 && (comDesfecho(l) || temInfoVencedor(l) || ['Disputa', 'Finalizada'].includes(faseId))
  const itens = mostrarItens ? part.map(it => {
    const sit = resultadoItem(it, l)
    return {
      numero: it.numero ?? '', descricao: it.descricao || '', quantidade: it.quantidade || '',
      colocacao: Number(it.colocacao) || null, situacao: sit,
      estimado: Number(it.valorUnitarioRef) || null,
      nossoValor: valorVencidoItem(it),
      primeiro: valor1oColocadoItem(it, l),
      vencedorNome: sit === 'ganho' ? '' : String(it.vencedorNome || '').trim(),
    }
  }) : []

  return {
    id: l.id,
    titulo: l.numeroEdital || 'Sem nº',
    situacao: situacaoLicitacao(l, faixaId),
    campos,
    link: l.link || '',
    objeto: String(l.objeto || '').trim(),
    homologada: comDesfecho(l) ? (l.dataHomologacao || '') : '',
    motivo: comDesfecho(l) ? String(l.motivo || '').trim() : '',
    nossoLance: nosso > 0 ? nosso : null,
    colocacao: l.colocacao || '',
    vencedor: (String(l.empresaVencedora || '').trim() || venceu) ? { nome: String(l.empresaVencedora || '').trim(), valor: venceu || null } : null,
    valorVencido: valorVencidoTotal(l),
    itens,
    observacoes: String(l.observacaoDisputa || '').trim(),
  }
}

// ── Resumo em texto (mesmas palavras na tela e no e-mail) ───────────────────
const pl = (n, s, p) => (n === 1 ? s : p)
export function resumoPartes(rel) {
  const P = (texto, negrito = false) => ({ texto, negrito })
  const total = rel.selecionadas.length
  if (!total) return [P('Não há licitações nas fases e no período selecionados.')]
  const partes = [P('Constam '), P(String(total), true), P(` ${pl(total, 'licitação', 'licitações')} nas fases selecionadas. `)]
  const d = rel.disputadas.length
  if (d) {
    partes.push(P('Participamos de '), P(String(d), true), P(` ${pl(d, 'licitação', 'licitações')} com resultado definido: vencemos `),
      P(String(rel.ganhas.length), true), P(' e perdemos '), P(String(rel.perdidas.length), true),
      P(' (taxa de sucesso de '), P(rel.taxa.toFixed(0) + '%', true), P('). '))
  }
  const np = rel.naoParticipamos.length
  if (np) partes.push(P('Decidimos não participar de '), P(String(np), true), P(` ${pl(np, 'oportunidade analisada', 'oportunidades analisadas')}. `))
  const ea = rel.emAndamento.length
  if (ea) partes.push(P(String(ea), true), P(` ${pl(ea, 'licitação segue', 'licitações seguem')} em andamento.`))
  return partes
}

// ── Cálculo do relatório ────────────────────────────────────────────────────
// lics/empenhos/cotacoes vêm sem filtro de empresa (como devolvidos pelas APIs).
//   de / ate            — período, "aaaa-mm-dd" (vazio = sem limite naquele lado)
//   fases               — ids das faixas incluídas (padrão: todas, menos Excluída)
//   incluirAnteriores   — traz também o que ficou SEM desfecho de períodos anteriores
//                         (em andamento), como o relatório mensal sempre fez
export function calcularRelatorio({
  lics: todasLics, empenhos: todosEmpenhos, cotacoes, empresaSel,
  de = '', ate = '', fases = FAIXAS_PADRAO, incluirAnteriores = true, hoje = hojeBR(),
}) {
  const faseSet = new Set(fases)
  const dentro = iso => iso && (!de || iso >= de) && (!ate || iso <= ate)

  const daEmpresa = todasLics.filter(l => l.empresa_id === empresaSel)
  const empenhos = todosEmpenhos.filter(e => e.empresa_id === empresaSel && dentro(isoDe(e.dataEmpenho)))

  // Nº de cotação de fornecedor por licitação — uma licitação pode ter
  // pedido cotação a mais de um fornecedor; junta os números preenchidos.
  const cotacoesPorLic = new Map()
  ;(cotacoes || []).forEach(c => {
    if (!c.numeroCotacaoFornecedor) return
    const lista = cotacoesPorLic.get(c.licitacaoId) || []
    lista.push(c.numeroCotacaoFornecedor)
    cotacoesPorLic.set(c.licitacaoId, lista)
  })

  // Quem já tem desfecho entra no período pela DATA DE HOMOLOGAÇÃO (é o campo
  // que a tela de Andamento explica: "o mês em que a licitação entra no
  // relatório"); sem homologação, cai pra sessão/limite/abertura. Quem ainda
  // não tem desfecho entra pela data da sessão/limite/abertura.
  const refISO = l => (comDesfecho(l) ? (isoDe(l.dataHomologacao) || isoDe(dataRef(l))) : isoDe(dataRef(l)))

  const faixaPorId = new Map(daEmpresa.map(l => [l.id, faixaDe(l, { hoje })]))

  const noPeriodo = l => {
    const r = refISO(l)
    const ativa = FAIXAS_ATIVAS.includes(faixaPorId.get(l.id))
    const pendente = !comDesfecho(l) && ativa
    if (!r) return pendente && incluirAnteriores              // sem data nenhuma: só como "em andamento"
    if (dentro(r)) return true
    return pendente && incluirAnteriores && !!de && r < de     // ficou pendente de antes do período
  }

  const selecionadas = daEmpresa.filter(l => faseSet.has(faixaPorId.get(l.id)) && noPeriodo(l))

  const grupos = FAIXAS.map(faixa => ({
    faixa,
    licitacoes: selecionadas
      .filter(l => faixaPorId.get(l.id) === faixa.id)
      .sort((a, b) => (refISO(a) || '9999').localeCompare(refISO(b) || '9999')),
  })).filter(g => g.licitacoes.length)

  const disputadas = selecionadas.filter(l => ['Ganhamos', 'Perdemos', 'Desclassificados'].includes(l.resultado))
  const ganhas = selecionadas.filter(l => l.resultado === 'Ganhamos')
  const perdidas = selecionadas.filter(l => ['Perdemos', 'Desclassificados'].includes(l.resultado))
  const naoParticipamos = selecionadas.filter(l => l.resultado === 'Nao participamos')
  const emAndamento = selecionadas.filter(l => !comDesfecho(l) && !['Excluida', 'Descartado'].includes(faixaPorId.get(l.id)))
  const taxa = disputadas.length ? (ganhas.length / disputadas.length) * 100 : 0

  return {
    grupos, selecionadas, disputadas, ganhas, perdidas, naoParticipamos, emAndamento, taxa,
    cotacoesPorLic,
    faturamento: empenhos.reduce((s, e) => s + e.faturamento, 0),
    receita: empenhos.reduce((s, e) => s + e.receita, 0),
    empenhos,
  }
}
