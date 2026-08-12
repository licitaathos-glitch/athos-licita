'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useApp } from '@/lib/AppContext'
import { Cartao, Janela, LinhaJanela } from '@/components/CartoesDashboard'
import ModalDetalheLicitacao from '@/components/ModalDetalheLicitacao'
import ModalNovaTarefa from '@/components/ModalNovaTarefa'
import { paraData } from '@/lib/notificacoes'
import { faseDe } from '@/lib/fases'
import { rotuloTipo } from '@/lib/tiposCertidao'

const DIA = 24 * 60 * 60 * 1000
const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#CBD5E1' }
const zerar = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const hora = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dataCurta = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export default function DashboardPage() {
  const { usuario, empresaAtual } = useApp()
  const [dados, setDados] = useState(null)
  const [agenda, setAgenda] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [erro, setErro] = useState('')

  // Qual janela está aberta e o que está aberto por cima dela. O Dashboard
  // nunca é abandonado: fechar a licitação devolve à lista, fechar a lista
  // devolve aos cartões.
  const [janela, setJanela] = useState(null)
  const [empresaAberta, setEmpresaAberta] = useState(null)
  const [licAberta, setLicAberta] = useState(null)
  const [carregandoLic, setCarregandoLic] = useState(false)
  const [novaTarefa, setNovaTarefa] = useState(false)

  function carregarTarefas() {
    fetch('/api/tarefas').then(r => r.json()).then(r => r.sucesso && setTarefas(r.tarefas)).catch(() => {})
  }

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json())
      .then(r => (r.sucesso ? setDados(r) : setErro(r.erro || 'Erro ao carregar.')))
      .catch(() => setErro('Erro de conexão.'))
    fetch('/api/agenda').then(r => r.json())
      .then(r => setAgenda(r.sucesso ? r : { licitacoes: [], cotacoes: [] }))
      .catch(() => setAgenda({ licitacoes: [], cotacoes: [] }))
    carregarTarefas()
  }, [])

  async function abrirLicitacao(id) {
    setCarregandoLic(true)
    try {
      const r = await fetch('/api/licitacoes').then(x => x.json())
      const l = r.sucesso ? r.licitacoes.find(x => String(x.id) === String(id)) : null
      if (l) setLicAberta(l)
      else setErro('Não consegui abrir esta licitação.')
    } catch { setErro('Erro de conexão ao abrir a licitação.') }
    setCarregandoLic(false)
  }

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : ''

  const grupos = useMemo(() => {
    if (!agenda) return { hoje: [], andamento: [], futuras: [], cotacoes: [] }
    const agora = new Date()
    const inicioHoje = zerar(agora)
    const fimSemana = new Date(inicioHoje.getTime() + 8 * DIA)

    const comData = (agenda.licitacoes || [])
      .filter(l => !empresaSel || String(l.empresaId) === empresaSel)
      .map(l => ({ ...l, data: paraData(l.quando) }))
      .filter(l => l.data)
      .sort((a, b) => a.data - b.data)

    const idsVisiveis = new Set(comData.map(l => String(l.id)))
    return {
      andamento: comData.filter(l => l.data < inicioHoje),
      hoje: comData.filter(l => l.data >= inicioHoje && l.data < new Date(inicioHoje.getTime() + DIA)),
      futuras: comData.filter(l => l.data >= new Date(inicioHoje.getTime() + DIA) && l.data < fimSemana),
      cotacoes: (agenda.cotacoes || [])
        .filter(c => !empresaSel || !c.licitacaoId || idsVisiveis.has(String(c.licitacaoId))),
    }
  }, [agenda, empresaSel])

  if (erro && !dados) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const perfil = String(usuario?.perfil || '').toLowerCase()
  const empresas = empresaSel ? dados.empresas.filter(e => String(e.id) === empresaSel) : dados.empresas
  const comPendencia = empresas.filter(e => e.vencidas > 0 || e.alerta > 0)
  const pendentes = tarefas.filter(t => t.status !== 'Concluída' && (!empresaSel || !t.empresaId || t.empresaId === empresaSel))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Dashboard</h2>
          <p className="sec-sub">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setNovaTarefa(true)}>+ Tarefa</button>
          {perfil === 'adm' && <Link href="/dashboard/empresas" className="btn-ghost">+ Empresa</Link>}
          {perfil === 'adm' && <Link href="/dashboard/usuarios" className="btn-ghost">+ Usuário</Link>}
        </div>
      </div>

      {/* Seis janelas: três em cima, três embaixo. No celular viram uma coluna. */}
      <div className="dash-grid">
        <Cartao
          icone="🏢" titulo="Empresas" total={empresas.length} cor="#145653"
          vazio="Nenhuma empresa cadastrada."
          linhas={empresas.map(e => `${e.nome}${e.vencidas ? ` · ${e.vencidas} vencida(s)` : ''}`)}
          onAbrir={() => setJanela('empresas')} />

        <Cartao
          icone="📌" titulo="Licitações de hoje" total={grupos.hoje.length} cor="#B45309"
          vazio="Nenhuma sessão hoje."
          linhas={grupos.hoje.map(l => `${hora(l.data)} · ${l.numeroEdital} — ${l.orgao || l.empresaNome}`)}
          onAbrir={() => setJanela('hoje')} />

        <Cartao
          icone="▶️" titulo="Em andamento" total={grupos.andamento.length} cor="#D97706"
          vazio="Nada em andamento."
          linhas={grupos.andamento.map(l => `${dataCurta(l.data)} · ${l.numeroEdital} — ${l.orgao || l.empresaNome}`)}
          onAbrir={() => setJanela('andamento')} />

        <Cartao
          icone="📆" titulo="Próximos 7 dias" total={grupos.futuras.length} cor="#0369A1"
          vazio="Nada marcado para a semana."
          linhas={grupos.futuras.map(l => `${dataCurta(l.data)} ${hora(l.data)} · ${l.numeroEdital}`)}
          onAbrir={() => setJanela('futuras')} />

        <Cartao
          icone="✔️" titulo="Tarefas pendentes" total={pendentes.length} cor="#0F766E"
          vazio="Nenhuma tarefa pendente."
          linhas={pendentes.map(t => t.titulo)}
          onAbrir={() => setJanela('tarefas')} />

        <Cartao
          icone="⏳" titulo="Cotações sem resposta" total={grupos.cotacoes.length} cor="#9333EA"
          vazio="Nenhum pedido aguardando fornecedor."
          linhas={grupos.cotacoes.map(c => `${c.edital} · ${c.destinatario}`)}
          onAbrir={() => setJanela('cotacoes')} />
      </div>

      {janela === 'empresas' && (
        <Janela titulo="Empresas" subtitulo={`${empresas.length} cadastrada(s) · ${comPendencia.length} com pendência`}
          onFechar={() => { setJanela(null); setEmpresaAberta(null) }}>
          {empresas.map(e => (
            <div key={e.id}>
              <LinhaJanela
                marcador={CORES[e.status]}
                titulo={e.nome}
                detalhe={`${e.cnpj}${e.responsavel ? ' · ' + e.responsavel : ''}`}
                extra={e.vencidas ? `${e.vencidas} vencida(s)` : e.alerta ? `${e.alerta} vencendo` : 'regular'}
                onClick={() => setEmpresaAberta(empresaAberta === e.id ? null : e.id)} />
              {empresaAberta === e.id && (
                <div style={{ margin: '-2px 0 12px 14px' }}>
                  {(e.pendencias || []).length === 0
                    ? <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 6px' }}>Nenhuma certidão vencida ou vencendo nos próximos 7 dias.</p>
                    : e.pendencias.map((p, i) => (
                      <div key={i} style={{ fontSize: 12, color: p.dias < 0 ? '#B91C1C' : '#B45309', padding: '3px 0' }}>
                        {p.dias < 0 ? '⛔' : '⚠️'} {rotuloTipo(p.tipo)} — {p.validade}
                        {p.dias < 0 ? ` (vencida há ${Math.abs(p.dias)} dia(s))` : ` (vence em ${p.dias} dia(s))`}
                      </div>
                    ))}
                  <Link href="/dashboard/certidoes" className="iBtn" style={{ marginTop: 4, display: 'inline-block' }}>
                    abrir Certidões →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </Janela>
      )}

      {['hoje', 'andamento', 'futuras'].includes(janela) && (
        <Janela
          titulo={{ hoje: 'Licitações de hoje', andamento: 'Em andamento', futuras: 'Próximos 7 dias' }[janela]}
          subtitulo="Clique para abrir a licitação sem sair do Dashboard"
          onFechar={() => setJanela(null)}>
          {grupos[janela].map(l => {
            const f = faseDe(l.fase)
            return (
              <LinhaJanela key={l.id} marcador={f.cor}
                titulo={`${dataCurta(l.data)} ${hora(l.data)} · ${l.numeroEdital}`}
                detalhe={[l.empresaNome, l.orgao, l.portal].filter(Boolean).join(' · ') + (l.objeto ? ' — ' + l.objeto : '')}
                extra={f.nome}
                onClick={() => abrirLicitacao(l.id)} />
            )
          })}
        </Janela>
      )}

      {janela === 'tarefas' && (
        <Janela titulo="Tarefas pendentes" subtitulo={`${pendentes.length} pendente(s)`} onFechar={() => setJanela(null)}>
          <button className="iBtn iBtn-up" style={{ marginBottom: 10 }} onClick={() => setNovaTarefa(true)}>+ Nova tarefa</button>
          {pendentes.length === 0 && <p style={{ fontSize: 12.5, color: '#94A3B8' }}>Nenhuma tarefa pendente.</p>}
          {pendentes.map(t => {
            const prazo = paraData(t.prazo)
            const atrasada = prazo && prazo < new Date()
            return (
              <LinhaJanela key={t.id} marcador={atrasada ? '#DC2626' : '#0F766E'}
                titulo={t.titulo}
                detalhe={[
                  prazo ? (atrasada ? '⚠️ venceu em ' : 'até ') + prazo.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sem prazo',
                  t.empresaNome,
                ].filter(Boolean).join(' · ')}
                extra={t.prioridade}
                onClick={t.licitacaoId ? () => abrirLicitacao(t.licitacaoId) : undefined} />
            )
          })}
        </Janela>
      )}

      {janela === 'cotacoes' && (
        <Janela titulo="Cotações sem resposta" subtitulo="Pedidos enviados que o fornecedor ainda não respondeu"
          onFechar={() => setJanela(null)}>
          {grupos.cotacoes.length === 0 && <p style={{ fontSize: 12.5, color: '#94A3B8' }}>Nenhum pedido aguardando resposta.</p>}
          {grupos.cotacoes.map(c => (
            <LinhaJanela key={c.id} marcador="#9333EA"
              titulo={`${c.edital} — ${c.destinatario || 'sem e-mail'}`}
              detalhe={[c.empresaNome, c.objeto].filter(Boolean).join(' · ')}
              onClick={c.licitacaoId ? () => abrirLicitacao(c.licitacaoId) : undefined} />
          ))}
        </Janela>
      )}

      {carregandoLic && (
        <div className="overlay"><div className="modal"><div className="modal-body">Abrindo a licitação...</div></div></div>
      )}

      {licAberta && (
        <ModalDetalheLicitacao
          lic={licAberta} fx={faseDe(licAberta.fase)} somenteConsulta
          onFechar={() => setLicAberta(null)} />
      )}

      {novaTarefa && (
        <ModalNovaTarefa onFechar={() => setNovaTarefa(false)} onSalvo={carregarTarefas} />
      )}
    </div>
  )
}
