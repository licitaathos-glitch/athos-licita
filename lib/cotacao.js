// Pedido de cotação a fornecedores — link público (token aleatório, sem
// login) que abre só aquele pedido específico, nada mais do sistema.
export const COLS_COTACAO = [
  'id', 'licitacaoId', 'empresaId', 'empresaNome', 'numeroEdital', 'objeto',
  'itensJson', 'destinatarioEmail', 'mensagem', 'token', 'status',
  'respostaItensJson', 'numeroCotacaoFornecedor', 'anexoDriveId', 'anexoDriveUrl',
  'respondidoPor', 'respondidoEm', 'criadoEm',
]

export function parseItensCotacao(json) {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : [] } catch { return [] }
}
