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

// Formas de apresentar o preço, conforme o edital
export const FORMAS_VALOR = [
  { id: 'unitario',  nome: 'Unitário' },
  { id: 'mensal',    nome: 'Mensal' },
  { id: 'global',    nome: 'Global / Lote' },
  { id: 'anual',     nome: 'Anual' },
  { id: 'desconto',  nome: '% de desconto' },
  { id: 'hora',      nome: 'Por hora' },
  { id: 'm2',        nome: 'Por m²' },
]

export const nomeForma = id => FORMAS_VALOR.find(f => f.id === id)?.nome || 'Unitário'

// Converte "dd/mm/aaaa hh:mm" em Date
export function dataHoraBR(v) {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/)
  if (!m) return null
  const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0))
  return isNaN(d) ? null : d
}

// Assim que chega a data e hora marcada, quem está "Aguardando disputa"
// passa sozinho para "Fase de lances".
export function faseAutomatica(lic) {
  const fase = lic.fase || faseInferida(lic)
  if (fase !== 'Aguardando') return fase
  const marcada = dataHoraBR(lic.dataSessao) || dataHoraBR(lic.dataLimite) || dataHoraBR(lic.dataAbertura)
  if (marcada && marcada <= new Date()) return 'Lances'
  return fase
}
