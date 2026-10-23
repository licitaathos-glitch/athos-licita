// Fases do fluxo de uma licitação — usadas no quadro tipo Trello
export const FASES = [
  { id: 'Em analise',    nome: 'Em análise',           cor: '#6366F1', desc: 'Lendo o edital e decidindo' },
  { id: 'Inscricao',     nome: 'Inscrição de proposta', cor: '#0EA5E9', desc: 'Cadastrando proposta no portal' },
  { id: 'Aguardando',    nome: 'Aguardando disputa',    cor: '#8B5CF6', desc: 'Proposta enviada, sessão marcada' },
  { id: 'Disputa',       nome: 'Disputa',               cor: '#D97706', desc: 'Lances, habilitação e documentos' },
  { id: 'Finalizada',    nome: 'Finalizada',            cor: '#16A34A', desc: 'Resultado definido' },
  { id: 'Descartado',    nome: 'Descartado',            cor: '#94A3B8', desc: 'Não vamos disputar' },
  // Ao lado de Descartado, mas com outro sentido: Descartado é decisão sobre o
  // processo (não vamos disputar); Excluída é a licitação saindo da lista
  // principal e do relatório mensal SEM apagar o registro — dá para saber
  // depois quais foram excluídas e trazer alguma de volta.
  { id: 'Excluida',      nome: 'Excluída',              cor: '#DC2626', desc: 'Fora da lista principal e do relatório' },
]

// As fases reais do fluxo, sem Excluída — usadas onde se escolhe/move a fase,
// para não misturar "onde está no processo" com "apaguei". Excluída só se
// alcança pelo botão Excluir; e só aparece como opção quando já é a fase atual
// (aí dá para escolher outra e restaurar).
export const FASES_FLUXO = FASES.filter(f => f.id !== 'Excluida')
export const opcoesFase = faseAtualId => (normalizarFase(faseAtualId) === 'Excluida' ? FASES : FASES_FLUXO)

export const faseDe = id => FASES.find(f => f.id === normalizarFase(id)) || FASES[0]

// Registros antigos usavam duas fases separadas — hoje ambas viram "Disputa"
export function normalizarFase(id) {
  if (id === 'Lances' || id === 'Habilitacao') return 'Disputa'
  return id
}

// Deduz a fase de licitações antigas, que ainda não têm o campo preenchido
export function faseInferida(lic) {
  if (lic.fase) return normalizarFase(lic.fase)
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
  // Licitação suspensa pelo órgão (status mudado em Editar) não vai ter a
  // sessão na data original: avançá-la para Disputa quando o horário passa a
  // tirava da aba Suspensas justo quando ela mais precisava ficar ali. A
  // suspensão de sessão (evento) continua avançando — a sessão voltou na data
  // remarcada e a licitação segue para a Disputa normalmente.
  if (lic.status === 'Suspensa' && lic.origemSuspensao === 'edicao') return fase
  const marcada = dataHoraBR(lic.dataSessao) || dataHoraBR(lic.dataLimite) || dataHoraBR(lic.dataAbertura)
  if (marcada && marcada <= new Date()) return 'Disputa'
  return fase
}

// ── Abas da lista de licitações ────────────────────────────────────────────
// Além das fases, a lista tem duas faixas DERIVADAS (não são fases gravadas na
// licitação — são calculadas a cada abertura da tela):
//   Licitações do dia — sessão marcada para HOJE, ainda em Aguardando ou Disputa.
//                       Fica entre as duas abas, que é onde elas ficavam soltas.
//   Suspensas         — licitação suspensa pelo órgão (status "Suspensa" mudado em
//                       Editar) que AINDA NÃO teve disputa. A "sessão suspensa,
//                       aguardando retorno" (evento registrado no Andamento) não
//                       entra aqui: continua na aba em que estava.
export const FAIXA_DIA = { id: 'Dia', nome: 'Licitações do dia', cor: '#0D9488', desc: 'Sessão marcada para hoje' }
export const FAIXA_SUSPENSAS = { id: 'Suspensas', nome: 'Suspensas', cor: '#EA580C', desc: 'Suspensas antes da disputa' }

export const ABAS_LISTA = FASES.flatMap(f =>
  f.id === 'Aguardando' ? [f, FAIXA_DIA] : f.id === 'Disputa' ? [f, FAIXA_SUSPENSAS] : [f])

const FASES_ANTES_DA_DISPUTA = ['Em analise', 'Inscricao', 'Aguardando']

// "dd/mm/aaaa" de hoje no horário de Brasília (a Vercel roda em UTC: sem fixar o
// fuso, à noite "hoje" já seria amanhã)
export function hojeBR(agora = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(agora)
}

// Dia da sessão como "dd/mm/aaaa" — mesma data que a lista exibe (sessão, senão
// limite da proposta, senão abertura)
export function diaDaSessao(l) {
  const m = String(l.dataSessao || l.dataLimite || l.dataAbertura || '').match(/(\d{2}\/\d{2}\/\d{4})/)
  return m ? m[1] : ''
}

// 'sessao' (evento "Sessão suspensa") | 'edicao' (status mudado em Editar) | ''.
// Licitações suspensas ANTES desta marcação existir não têm o campo: nelas, a
// existência de um evento de suspensão registrado decide.
export function origemSuspensao(l, registros = []) {
  if (String(l.status || '') !== 'Suspensa') return ''
  if (l.origemSuspensao === 'sessao' || l.origemSuspensao === 'edicao') return l.origemSuspensao
  return registros.some(r => r.tipoEvento === 'suspensao') ? 'sessao' : 'edicao'
}

// A aba (fase ou faixa) em que a licitação aparece na lista
export function faixaDe(l, { registros = [], hoje = hojeBR() } = {}) {
  const fase = normalizarFase(l.fase || 'Em analise')
  if (origemSuspensao(l, registros) === 'edicao') {
    return FASES_ANTES_DA_DISPUTA.includes(fase) ? FAIXA_SUSPENSAS.id : fase
  }
  if ((fase === 'Aguardando' || fase === 'Disputa') && diaDaSessao(l) === hoje) return FAIXA_DIA.id
  return fase
}
