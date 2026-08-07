// Tipos de evento que podem ser registrados dentro de uma licitação e
// virarem um lembrete no calendário. Cada tipo define o ícone usado no
// calendário e, quando faz sentido, um status que a licitação passa a
// assumir (ex: "Suspensa"). Registrar um evento nunca mexe sozinho na
// data da sessão — isso é sempre um ajuste manual, feito à parte, porque a
// data do evento aqui é só a prevista/planejada, não uma confirmação.
export const TIPOS_EVENTO = [
  { id: 'suspensao',   nome: 'Sessão suspensa (retorno previsto)', ico: '⏸', statusLic: 'Suspensa' },
  { id: 'remarcacao',  nome: 'Nova data de sessão (remarcação)',   ico: '🗓️', statusLic: '' },
  { id: 'diligencia',  nome: 'Diligência / esclarecimento',        ico: '📋', statusLic: '' },
  { id: 'impugnacao',  nome: 'Impugnação',                         ico: '⚖️', statusLic: '' },
  { id: 'recurso',     nome: 'Recurso',                            ico: '📨', statusLic: '' },
  { id: 'reuniao',     nome: 'Reunião / compromisso interno',      ico: '🤝', statusLic: '' },
  { id: 'outro',       nome: 'Outro (personalizado)',              ico: '📌', statusLic: '' },
]

export function tipoEventoInfo(id) {
  return TIPOS_EVENTO.find(t => t.id === id) || TIPOS_EVENTO[TIPOS_EVENTO.length - 1]
}
