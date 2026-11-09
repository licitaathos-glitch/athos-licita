import { nomesChunk } from './chunkCampo'

// Pedido de cotação a fornecedores — link público (token aleatório, sem
// login) que abre só aquele pedido específico, nada mais do sistema.
//
// itensJson/respostaItensJson vêm em várias colunas (itensJson, itensJson_2,
// ...) porque uma licitação de centenas de itens gera um JSON maior que o
// limite de 50.000 caracteres por célula do Google Sheets — o pedido de
// cotação de uma licitação de 743 itens caía nesse limite e o pedido nunca
// era criado. Mesma solução já usada em COLS_LIC (app/api/licitacoes/route.js).
export const COLS_COTACAO = [
  'id', 'licitacaoId', 'empresaId', 'empresaNome', 'numeroEdital', 'objeto',
  ...nomesChunk('itensJson'), 'destinatarioEmail', 'mensagem', 'token', 'status',
  'editalAnexoUrl', 'resumoTexto', 'linkLicitacao', 'dataSessao', 'srp',
  ...nomesChunk('respostaItensJson'), 'numeroCotacaoFornecedor', 'anexoDriveId', 'anexoDriveUrl',
  'respondidoPor', 'respondidoEm', 'criadoEm',
  // quando o e-mail de fato saiu, e se saiu ('enviado' | 'falhou'). criadoEm é só
  // o momento em que o pedido foi gravado — o e-mail pode ter falhado depois.
  'enviadoEm', 'emailStatus',
]

export function parseItensCotacao(json) {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : [] } catch { return [] }
}

// Id do arquivo a partir de um link do Google Drive (.../d/{id}/view ou ?id=)
export const idDoDrive = url => {
  const t = String(url || '')
  return (t.match(/\/d\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/) || [])[1] || ''
}

// Etapa do preço/cotação de uma licitação, usada no selo da lista e no painel de
// "cotações sem resposta" do Dashboard — as duas telas precisam concordar.
//   'pendente'    — pedido enviado, fornecedor ainda não respondeu, e o valor
//                   mínimo ainda não está lançado em todos os itens
//   'manual'      — há pedido sem resposta pela plataforma, mas o valor mínimo já
//                   está lançado em todos os itens: a cotação foi respondida por
//                   fora (e-mail, telefone, WhatsApp) e digitada à mão
//   'precificada' — todos os itens participando têm valor mínimo (vale mesmo sem
//                   pedido de cotação, ou com resposta pela plataforma)
//   'respondida'  — fornecedor respondeu, mas ainda falta preço em algum item
// `cot` = { pendentes, respondidas, total } da licitação; `itens` = lista de itens.
export function etapaCotacao(cot, itens) {
  const participando = (itens || []).filter(it => it.participar)
  const comValor = participando.filter(it => String(it.meuValor ?? '').trim() !== '')
  const precificada = participando.length > 0 && comValor.length === participando.length

  if (cot && cot.pendentes > 0) {
    // Antes, pedido pendente vencia qualquer preço lançado — a licitação ficava
    // "cotação pendente" mesmo com tudo precificado à mão.
    if (!precificada) return 'pendente'
    if (!cot.respondidas) return 'manual'
  }
  if (precificada) return 'precificada'
  if (cot && cot.total > 0) return 'respondida'
  return ''
}

// ── Datas do pedido de cotação (sempre no horário de Brasília) ─────────────
const FUSO = 'America/Sao_Paulo'

// "22/10/2026 às 14:32"; vazio se a data não existir ou for inválida
export function formatarDataHoraBR(iso) {
  const d = new Date(iso)
  if (!iso || isNaN(d)) return ''
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const g = t => p.find(x => x.type === t)?.value
  return `${g('day')}/${g('month')}/${g('year')} às ${g('hour')}:${g('minute')}`
}

// Dias de calendário entre duas datas, no fuso de Brasília — um pedido enviado
// às 23h de ontem e visto às 01h de hoje é "ontem", não "há 0 dias".
function diaBR(d) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d) // aaaa-mm-dd
  return Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) / 86400000
}
export function diasEntre(deIso, ateIso = new Date()) {
  const a = new Date(deIso), b = new Date(ateIso)
  if (!deIso || isNaN(a) || isNaN(b)) return null
  return Math.max(0, Math.round(diaBR(b) - diaBR(a)))
}

// "hoje" | "ontem" | "há 3 dias" — para pedido ainda sem resposta
export function haQuantosDias(iso, agora = new Date()) {
  const n = diasEntre(iso, agora)
  if (n === null) return ''
  return n === 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`
}

// "no mesmo dia" | "1 dia depois" | "4 dias depois" — enviado → respondido
export function tempoDeResposta(enviadoIso, respondidoIso) {
  const n = diasEntre(enviadoIso, respondidoIso)
  if (n === null) return ''
  return n === 0 ? 'no mesmo dia' : n === 1 ? '1 dia depois' : `${n} dias depois`
}
