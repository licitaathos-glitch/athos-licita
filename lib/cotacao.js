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
