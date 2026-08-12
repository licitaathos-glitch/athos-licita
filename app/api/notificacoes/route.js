import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { getUsuarioFromReq, empresasVisiveis } from '@/lib/auth'

// Devolve só as FONTES das notificações, cruas. Quem calcula "faltam 30 min" é
// o navegador: o servidor da Vercel roda em UTC e erraria o horário de
// Brasília, e a contagem precisa ser recalculada a cada minuto de qualquer
// forma. Aqui a gente só junta e filtra pelo que o usuário pode ver.
export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    const todasEmpresas = await lerAba('Empresas')
    const permitidas = new Set(empresasVisiveis(usuario, todasEmpresas.filter(e => e.id)).map(e => String(e.id).trim()))
    const podeVer = idEmpresa => !idEmpresa || permitidas.has(String(idEmpresa).trim())

    const [licitacoes, eventos] = await Promise.all([
      lerAba('Licitacoes'),
      lerAba('EventosCalendario').catch(() => []),
    ])

    // Sessões e prazos das licitações que ainda estão em jogo
    const emJogo = ['Finalizada', 'Descartado']
    const sessoes = licitacoes
      .filter(l => l.id && podeVer(l.empresaId))
      .filter(l => !emJogo.includes(String(l.fase || '')))
      .map(l => ({
        licitacaoId: l.id,
        empresaNome: l.empresaNome || '',
        edital: l.numeroEdital || l.numeroPNCP || 'Sem nº',
        objeto: String(l.objeto || '').slice(0, 90),
        orgao: l.orgao || '',
        quando: l.dataSessao || l.dataLimite || l.dataAbertura || '',
      }))
      .filter(s => s.quando)

    // Retorno de sessão suspensa / remarcação — data prevista do evento
    const retornos = (eventos || [])
      .filter(e => e.id && podeVer(e.empresaId))
      .filter(e => ['suspensao', 'remarcacao'].includes(String(e.tipoEvento || '')))
      .map(e => ({
        eventoId: e.id, licitacaoId: e.licitacaoId || '',
        empresaNome: e.empresaNome || '',
        edital: e.licitacaoEdital || '',
        titulo: e.titulo || 'Retorno de sessão',
        tipoEvento: e.tipoEvento,
        quando: e.data || '',
      }))
      .filter(e => e.quando)

    // Cotações já respondidas pelo fornecedor
    let cotacoes = []
    try {
      const porLicitacao = {}
      licitacoes.forEach(l => { if (l.id) porLicitacao[String(l.id).trim()] = l })
      cotacoes = (await lerAba('Cotacoes'))
        .filter(c => c.id && String(c.status || '') === 'Respondida' && c.respondidoEm)
        .filter(c => podeVer(c.empresaId))
        .map(c => {
          const lic = porLicitacao[String(c.licitacaoId || '').trim()]
          return {
            cotacaoId: c.id, licitacaoId: c.licitacaoId || '',
            empresaNome: c.empresaNome || '',
            edital: c.numeroEdital || (lic ? lic.numeroEdital : '') || '',
            fornecedor: c.destinatarioEmail || '',
            quando: c.respondidoEm,
          }
        })
    } catch { cotacoes = [] }

    // Tarefas: as pendentes com prazo e as concluídas recentemente
    let tarefas = []
    try {
      tarefas = (await lerAba('Tarefas'))
        .filter(t => t.id && podeVer(t.empresaId))
        .map(t => ({
          tarefaId: t.id, titulo: t.titulo || '', empresaNome: t.empresaNome || '',
          prazo: t.prazo || '', status: t.status || 'Pendente',
          concluidoEm: t.concluidoEm || '', prioridade: t.prioridade || 'Normal',
        }))
    } catch { tarefas = [] }

    return NextResponse.json({ sucesso: true, sessoes, retornos, cotacoes, tarefas })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
