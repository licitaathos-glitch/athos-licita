// Tipos de evento que podem ser registrados dentro de uma licitação e
// virarem um lembrete no calendário. Cada tipo define o ícone usado no
// calendário e se ele também deve atualizar a data da sessão/status da
// licitação (só faz sentido para os que representam uma remarcação real).
export const TIPOS_EVENTO = [
  { id: 'suspensao',   nome: 'Sessão suspensa (retorno previsto)', ico: '⏸', atualizaSessao: true, statusLic: 'Suspensa' },
  { id: 'remarcacao',  nome: 'Nova data de sessão (remarcação)',   ico: '🗓️', atualizaSessao: true, statusLic: '' },
  { id: 'diligencia',  nome: 'Diligência / esclarecimento',        ico: '📋', atualizaSessao: false, statusLic: '' },
  { id: 'impugnacao',  nome: 'Impugnação',                         ico: '⚖️', atualizaSessao: false, statusLic: '' },
  { id: 'recurso',     nome: 'Recurso',                            ico: '📨', atualizaSessao: false, statusLic: '' },
  { id: 'reuniao',     nome: 'Reunião / compromisso interno',      ico: '🤝', atualizaSessao: false, statusLic: '' },
  { id: 'outro',       nome: 'Outro (personalizado)',              ico: '📌', atualizaSessao: false, statusLic: '' },
]

export function tipoEventoInfo(id) {
  return TIPOS_EVENTO.find(t => t.id === id) || TIPOS_EVENTO[TIPOS_EVENTO.length - 1]
}
