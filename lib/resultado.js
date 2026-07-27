// Resultado da disputa e motivos — alimentam o relatório mensal do cliente

export const RESULTADOS = [
  { id: 'Aguardando',      nome: 'Aguardando sessão',    cor: '#3B82F6' },
  { id: 'Ganhamos',        nome: 'Ganhamos',             cor: '#16A34A' },
  { id: 'Perdemos',        nome: 'Perdemos',             cor: '#DC2626' },
  { id: 'Desclassificados',nome: 'Desclassificados',     cor: '#B91C1C' },
  { id: 'Nao participamos',nome: 'Não participamos',     cor: '#94A3B8' },
  { id: 'Deserta',         nome: 'Deserta / Fracassada', cor: '#D97706' },
  { id: 'Cancelada',       nome: 'Cancelada / Suspensa', cor: '#78716C' },
]

// Motivos padronizados — permitem agrupar no relatório em vez de texto livre
export const MOTIVOS_NAO_PARTICIPACAO = [
  'Valor estimado abaixo do nosso custo',
  'Exclusiva para ME/EPP',
  'Quantidade baixa — não justifica a operação',
  'Prazo de entrega inviável',
  'Sessão presencial fora da região',
  'Portal privado com taxa de participação',
  'Especificação técnica não atendida',
  'Documentação/habilitação não atendida',
  'Local de entrega inviabiliza o frete',
  'Não houve interesse comercial do cliente',
  'Outro',
]

export const MOTIVOS_PERDA = [
  'Preço final abaixo do nosso limite',
  'Empate ficto — preferência ME/EPP',
  'Concorrente com preço inexequível',
  'Desclassificação técnica (amostra/laudo)',
  'Desclassificação por habilitação',
  'Proposta fora do prazo ou com erro formal',
  'Outro',
]

export const COLS_RESULTADO = ['resultado','motivo','nossoLance','valorVencedor',
  'empresaVencedora','colocacao','observacaoDisputa']

export function corResultado(r) {
  return RESULTADOS.find(x => x.id === r)?.cor || '#94A3B8'
}
export function nomeResultado(r) {
  return RESULTADOS.find(x => x.id === r)?.nome || r || 'Aguardando'
}

// Extrai o mês (aaaa-mm) de uma data dd/mm/aaaa
export function mesDe(dataBR) {
  const m = String(dataBR || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}` : ''
}
