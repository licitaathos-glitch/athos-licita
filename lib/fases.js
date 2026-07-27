// Fases do fluxo de uma licitação — usadas no quadro tipo Trello
export const FASES = [
  { id: 'Em analise',    nome: 'Em análise',           cor: '#6366F1', desc: 'Lendo o edital e decidindo' },
  { id: 'Inscricao',     nome: 'Inscrição de proposta', cor: '#0EA5E9', desc: 'Cadastrando proposta no portal' },
  { id: 'Aguardando',    nome: 'Aguardando disputa',    cor: '#8B5CF6', desc: 'Proposta enviada, sessão marcada' },
  { id: 'Lances',        nome: 'Fase de lances',        cor: '#D97706', desc: 'Sessão em andamento' },
  { id: 'Habilitacao',   nome: 'Habilitação',           cor: '#0891B2', desc: 'Envio e análise de documentos' },
  { id: 'Finalizada',    nome: 'Finalizada',            cor: '#16A34A', desc: 'Resultado definido' },
  { id: 'Descartado',    nome: 'Descartado',            cor: '#94A3B8', desc: 'Não vamos disputar' },
]

export const faseDe = id => FASES.find(f => f.id === id) || FASES[0]

// Deduz a fase de licitações antigas, que ainda não têm o campo preenchido
export function faseInferida(lic) {
  if (lic.fase) return lic.fase
  if (lic.resultado === 'Nao participamos' || lic.participar === 'Não') return 'Descartado'
  if (['Ganhamos', 'Perdemos', 'Desclassificados', 'Deserta', 'Cancelada'].includes(lic.resultado)) return 'Finalizada'
  if (lic.status === 'Encerrada') return 'Finalizada'
  return 'Em analise'
}
