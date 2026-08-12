// Tipos de evento que podem ser registrados dentro de uma licitação e
// virarem um lembrete no calendário. Cada tipo define o ícone usado no
// calendário e, quando faz sentido, um status que a licitação passa a
// assumir (ex: "Suspensa").
//
// `remarcaSessao` marca os tipos em que a data informada É a nova data da
// sessão. Nesses casos a tela oferece atualizar a data da sessão junto,
// com a caixa já marcada — mas quem confirma é o usuário, nunca sozinho:
// a atualização automática silenciosa já existiu aqui e foi removida a
// pedido, justamente por mexer na data sem avisar.
export const TIPOS_EVENTO = [
  { id: 'suspensao',   nome: 'Sessão suspensa (retorno previsto)', ico: '⏸', statusLic: 'Suspensa', remarcaSessao: true },
  { id: 'remarcacao',  nome: 'Nova data de sessão (remarcação)',   ico: '🗓️', statusLic: '', remarcaSessao: true },
  { id: 'diligencia',  nome: 'Diligência / esclarecimento',        ico: '📋', statusLic: '' },
  { id: 'impugnacao',  nome: 'Impugnação',                         ico: '⚖️', statusLic: '' },
  { id: 'recurso',     nome: 'Recurso',                            ico: '📨', statusLic: '' },
  { id: 'reuniao',     nome: 'Reunião / compromisso interno',      ico: '🤝', statusLic: '' },
  { id: 'outro',       nome: 'Outro (personalizado)',              ico: '📌', statusLic: '' },
]

export function tipoEventoInfo(id) {
  return TIPOS_EVENTO.find(t => t.id === id) || TIPOS_EVENTO[TIPOS_EVENTO.length - 1]
}
