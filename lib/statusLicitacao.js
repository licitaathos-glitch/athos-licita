// Status possíveis de uma licitação — separado da fase (fase é o andamento
// interno do processo; status é a situação oficial dela no portal/PNCP)
export const STATUS_LIC = [
  { id: 'Aberta',    nome: 'Aberta',            cor: '#16A34A' },
  { id: 'Suspensa',  nome: 'Suspensa',          cor: '#D97706' },
  { id: 'Anulada',   nome: 'Anulada/Revogada',  cor: '#DC2626' },
  { id: 'Encerrada', nome: 'Encerrada',          cor: '#64748B' },
]

export const corStatus = id => STATUS_LIC.find(s => s.id === id)?.cor || '#64748B'
export const nomeStatus = id => STATUS_LIC.find(s => s.id === id)?.nome || id || 'Aberta'
