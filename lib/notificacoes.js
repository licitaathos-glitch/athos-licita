// Monta a lista de notificações a partir das fontes cruas de /api/notificacoes.
// Roda no navegador de propósito: o horário que importa é o de quem está
// olhando a tela, e "faltam 30 minutos" precisa ser recalculado o tempo todo.

// Aceita "DD/MM/AAAA HH:MM", "AAAA-MM-DDTHH:MM" e ISO com fuso.
export function paraData(valor) {
  if (!valor) return null
  const s = String(valor).trim()
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,T]+(\d{2}):(\d{2}))?/)
  if (br) return new Date(+br[3], +br[2] - 1, +br[1], +(br[4] || 0), +(br[5] || 0))
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/)
  if (iso && !s.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 0), +(iso[5] || 0))
  }
  const d = new Date(s)
  return isNaN(d) ? null : d
}

const MIN = 60 * 1000
const diaDe = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
const mesmoDia = (a, b) => diaDe(a) === diaDe(b)
const horaBR = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dataBR = d => d.toLocaleDateString('pt-BR')

// Avisos de um compromisso com hora marcada: véspera, no dia, 30 min e 10 min.
// Devolve o aviso mais urgente que se aplica agora — nunca os quatro de uma vez.
function avisoDeHorario(quando, agora) {
  const faltaMin = (quando - agora) / MIN
  if (faltaMin < -15) return null                       // já passou, para de avisar
  if (faltaMin <= 10) return { chave: '10m', urgencia: 'alta', texto: faltaMin <= 0 ? 'começando agora' : `em ${Math.ceil(faltaMin)} min` }
  if (faltaMin <= 30) return { chave: '30m', urgencia: 'alta', texto: `em ${Math.ceil(faltaMin)} min` }
  if (mesmoDia(quando, agora)) return { chave: 'hoje', urgencia: 'media', texto: `hoje às ${horaBR(quando)}` }
  const amanha = new Date(agora); amanha.setDate(amanha.getDate() + 1)
  if (mesmoDia(quando, amanha)) return { chave: 'd1', urgencia: 'media', texto: `amanhã às ${horaBR(quando)}` }
  return null
}

export function montarNotificacoes(fontes, agora = new Date()) {
  const lista = []
  const { sessoes = [], retornos = [], cotacoes = [], tarefas = [] } = fontes || {}

  // ── Sessões de licitação ────────────────────────────────────────────────
  for (const s of sessoes) {
    const quando = paraData(s.quando)
    if (!quando) continue
    const aviso = avisoDeHorario(quando, agora)
    if (!aviso) continue
    lista.push({
      id: `sessao-${aviso.chave}:${s.licitacaoId}:${diaDe(quando)}`,
      tipo: 'sessao', icone: '⚖️', urgencia: aviso.urgencia, quando,
      titulo: `Sessão ${aviso.texto} — ${s.edital}`,
      detalhe: [s.empresaNome, s.orgao].filter(Boolean).join(' · '),
      href: `/dashboard/licitacoes?id=${s.licitacaoId}`,
    })
  }

  // ── Retorno de sessão suspensa / remarcação ─────────────────────────────
  for (const r of retornos) {
    const quando = paraData(r.quando)
    if (!quando) continue
    const aviso = avisoDeHorario(quando, agora)
    if (!aviso) continue
    lista.push({
      id: `retorno-${aviso.chave}:${r.eventoId}:${diaDe(quando)}`,
      tipo: 'retorno', icone: r.tipoEvento === 'suspensao' ? '⏸' : '🗓️',
      urgencia: aviso.urgencia, quando,
      titulo: `Retorno ${aviso.texto}${r.edital ? ' — ' + r.edital : ''}`,
      detalhe: [r.empresaNome, r.titulo].filter(Boolean).join(' · '),
      href: r.licitacaoId ? `/dashboard/licitacoes?id=${r.licitacaoId}` : '/dashboard',
    })
  }

  // ── Cotações respondidas pelo fornecedor (últimos 30 dias) ──────────────
  for (const c of cotacoes) {
    const quando = paraData(c.quando)
    if (!quando || (agora - quando) > 30 * 24 * 60 * MIN) continue
    lista.push({
      id: `cotacao:${c.cotacaoId}`,
      tipo: 'cotacao', icone: '📥', urgencia: 'media', quando,
      titulo: `Cotação respondida${c.edital ? ' — ' + c.edital : ''}`,
      detalhe: [c.fornecedor, c.empresaNome].filter(Boolean).join(' · '),
      href: c.licitacaoId ? `/dashboard/licitacoes?id=${c.licitacaoId}` : '/dashboard',
    })
  }

  // ── Tarefas ─────────────────────────────────────────────────────────────
  for (const t of tarefas) {
    if (t.status === 'Concluída') {
      const quando = paraData(t.concluidoEm)
      if (!quando || (agora - quando) > 7 * 24 * 60 * MIN) continue
      lista.push({
        id: `tarefa-ok:${t.tarefaId}`,
        tipo: 'tarefa', icone: '✅', urgencia: 'baixa', quando,
        titulo: `Tarefa concluída — ${t.titulo}`,
        detalhe: t.empresaNome, href: '/dashboard',
      })
      continue
    }
    const prazo = paraData(t.prazo)
    if (!prazo) continue
    const atrasada = prazo < agora
    const aviso = avisoDeHorario(prazo, agora)
    if (!atrasada && !aviso) continue
    lista.push({
      id: atrasada ? `tarefa-atraso:${t.tarefaId}:${diaDe(agora)}` : `tarefa-${aviso.chave}:${t.tarefaId}:${diaDe(prazo)}`,
      tipo: 'tarefa', icone: atrasada ? '⚠️' : '🕓',
      urgencia: atrasada ? 'alta' : aviso.urgencia, quando: prazo,
      titulo: atrasada ? `Tarefa atrasada — ${t.titulo}` : `Tarefa ${aviso.texto} — ${t.titulo}`,
      detalhe: [t.empresaNome, atrasada ? 'venceu em ' + dataBR(prazo) : ''].filter(Boolean).join(' · '),
      href: '/dashboard',
    })
  }

  const peso = { alta: 0, media: 1, baixa: 2 }
  lista.sort((a, b) => (peso[a.urgencia] - peso[b.urgencia]) || (b.quando - a.quando))
  return lista
}
