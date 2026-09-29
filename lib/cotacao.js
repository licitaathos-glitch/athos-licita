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
