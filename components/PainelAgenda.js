'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/AppContext'
import { paraData } from '@/lib/notificacoes'
import { faseDe } from '@/lib/fases'

const DIA = 24 * 60 * 60 * 1000
const hora = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const zerar = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const rotuloDia = d => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

// Sessões de hoje e do resto da semana. Responde a pergunta que o dashboard
// antigo não respondia: o que acontece hoje e o que vem pela frente.
export default function PainelAgenda({ apenas = null, onAbrirLicitacao }) {
  const router = useRouter()
  const { empresaAtual } = useApp()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [agora, setAgora] = useState(() => new Date())
  // Seção aberta em tela cheia ({ titulo, itens }) quando a lista é longa
  const [verTodas, setVerTodas] = useState(null)

  useEffect(() => {
    fetch('/api/agenda').then(r => r.json())
      .then(r => (r.sucesso ? setLista(r.licitacoes) : setErro(r.erro || 'Erro ao carregar a agenda.')))
      .catch(() => setErro('Erro de conexão.'))
  }, [])

  // Mantém o "faltam X min" vivo sem recarregar nada do servidor
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const { hoje, semana, emAndamento } = useMemo(() => {
    const vazio = { hoje: [], semana: [], emAndamento: [] }
    if (!lista) return vazio
    const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : ''
    const inicioHoje = zerar(agora)
    const fimSemana = new Date(inicioHoje.getTime() + 8 * DIA)

    const comData = lista
      .filter(l => !empresaSel || String(l.empresaId) === empresaSel)
      .map(l => ({ ...l, data: paraData(l.quando) }))
      .filter(l => l.data)
      .sort((a, b) => a.data - b.data)

    return {
      // Sessão já começou e a licitação continua em aberto: ou está rolando de
      // fato, ou é registro que ficou para trás esperando desfecho.
      emAndamento: comData.filter(l => l.data < inicioHoje),
      hoje: comData.filter(l => l.data >= inicioHoje && l.data < new Date(inicioHoje.getTime() + DIA)),
      semana: comData.filter(l => l.data >= new Date(inicioHoje.getTime() + DIA) && l.data < fimSemana),
    }
  }, [lista, empresaAtual, agora])

  if (erro) return <div className="form-card"><div className="l-err">{erro}</div></div>
  if (!lista) return <div className="form-card"><p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Carregando agenda...</p></div>

  const Linha = ({ l, mostrarDia }) => {
    const f = faseDe(l.fase)
    const faltaMin = (l.data - agora) / 60000
    const iminente = faltaMin > 0 && faltaMin <= 60
    return (
      <div onClick={() => {
          setVerTodas(null)
          if (onAbrirLicitacao) onAbrirLicitacao(l.id)
          else router.push(`/dashboard/licitacoes?id=${l.id}`)
        }}
        style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 10px', cursor: 'pointer',
          borderRadius: 8, borderLeft: `3px solid ${f.cor}`,
          background: iminente ? '#FEF3C7' : '#F8FAFC', marginBottom: 6,
        }}>
        <div style={{ minWidth: 54, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: iminente ? '#B45309' : '#145653' }}>{hora(l.data)}</div>
          {mostrarDia && <div style={{ fontSize: 10, color: '#94A3B8' }}>{l.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2E2D2F' }}>
            {l.numeroEdital}
            {l.srp === 'Sim' && <span className="pill pill-gray" style={{ marginLeft: 6 }}>SRP</span>}
            {iminente && <span className="pill pill-amber" style={{ marginLeft: 6 }}>em {Math.ceil(faltaMin)} min</span>}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
            {[l.empresaNome, l.orgao, l.portal].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            {l.origemQuando !== 'sessão' && `${l.origemQuando} · `}{l.objeto}
          </div>
        </div>
        <span className="pill" style={{ background: f.cor + '22', color: f.cor, flexShrink: 0 }}>{f.nome}</span>
      </div>
    )
  }

  // Agrupa a semana por dia, para não virar uma lista corrida
  const porDia = []
  semana.forEach(l => {
    const chave = zerar(l.data).getTime()
    const grupo = porDia.find(g => g.chave === chave)
    if (grupo) grupo.itens.push(l)
    else porDia.push({ chave, data: l.data, itens: [l] })
  })

  // Uma seção por vez: o Dashboard monta uma janela para cada assunto, em
  // vez de empilhar tudo num bloco só e obrigar a rolar.
  if (apenas) {
    const conf = {
      hoje: { titulo: '📌 Hoje', itens: hoje, vazio: 'Nenhuma sessão hoje.', limite: 6, dia: false },
      andamento: { titulo: '▶️ Em andamento', itens: emAndamento, vazio: 'Nada em andamento.', limite: 6, dia: true },
      futuras: { titulo: '📆 Próximos 7 dias', itens: semana, vazio: 'Nada marcado para a semana.', limite: 6, dia: true },
    }[apenas]
    if (!conf) return null
    return (
      <div className="janela-dash">
        <div className="janela-dash-hdr">
          <span>{conf.titulo}</span>
          <span className="janela-dash-cont">{conf.itens.length}</span>
        </div>
        <div className="janela-dash-corpo">
          {conf.itens.length === 0
            ? <p style={{ fontSize: 12.5, color: '#94A3B8', margin: 0 }}>{conf.vazio}</p>
            : conf.itens.slice(0, conf.limite).map(l => <Linha key={l.id} l={l} mostrarDia={conf.dia} />)}
          {conf.itens.length > conf.limite && (
            <button className="iBtn" onClick={() => setVerTodas({ titulo: conf.titulo, itens: conf.itens })}>
              ver todas as {conf.itens.length} →
            </button>
          )}
        </div>

        {verTodas && (
          <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setVerTodas(null) }}>
            <div className="modal modal-lg">
              <div className="modal-hdr">
                <div>
                  <div className="modal-hdr-sub">AGENDA</div>
                  <div className="modal-hdr-title">{verTodas.titulo}</div>
                  <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>
                    {verTodas.itens.length} licitação(ões)
                  </div>
                </div>
                <button className="modal-x" onClick={() => setVerTodas(null)}>×</button>
              </div>
              <div className="modal-body">
                {verTodas.itens.map(l => <Linha key={l.id} l={l} mostrarDia />)}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="form-card">
      {emAndamento.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#B45309', marginBottom: 6 }}>
            ▶️ Em andamento ({emAndamento.length})
          </div>
          {emAndamento.slice(0, 5).map(l => <Linha key={l.id} l={l} mostrarDia />)}
          {emAndamento.length > 5 && (
            <button className="iBtn" onClick={() => setVerTodas({ titulo: 'Em andamento', itens: emAndamento })}>
              ver todas as {emAndamento.length} →
            </button>
          )}
        </div>
      )}

      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#145653', marginBottom: 6 }}>
        📌 Hoje ({hoje.length})
      </div>
      {hoje.length === 0
        ? <p style={{ fontSize: 12.5, color: '#94A3B8', margin: '0 0 14px' }}>Nenhuma sessão hoje.</p>
        : (
          <div style={{ marginBottom: 14 }}>
            {hoje.slice(0, 8).map(l => <Linha key={l.id} l={l} />)}
            {hoje.length > 8 && (
              <button className="iBtn" onClick={() => setVerTodas({ titulo: 'Sessões de hoje', itens: hoje })}>
                ver todas as {hoje.length} →
              </button>
            )}
          </div>
        )}

      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#145653', marginBottom: 6 }}>
        📆 Próximos 7 dias ({semana.length})
      </div>
      {semana.length === 0
        ? <p style={{ fontSize: 12.5, color: '#94A3B8', margin: 0 }}>Nada marcado para a semana.</p>
        : (
          <>
            {porDia.map(g => (
              <div key={g.chave} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'capitalize', marginBottom: 4 }}>{rotuloDia(g.data)}</div>
                {g.itens.map(l => <Linha key={l.id} l={l} />)}
              </div>
            ))}
            <button className="iBtn" onClick={() => setVerTodas({ titulo: 'Próximos 7 dias', itens: semana })}>
              ver em lista única →
            </button>
          </>
        )}

      {verTodas && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setVerTodas(null) }}>
          <div className="modal modal-lg">
            <div className="modal-hdr">
              <div>
                <div className="modal-hdr-sub">AGENDA</div>
                <div className="modal-hdr-title">{verTodas.titulo}</div>
                <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>
                  {verTodas.itens.length} licitação(ões)
                </div>
              </div>
              <button className="modal-x" onClick={() => setVerTodas(null)}>×</button>
            </div>
            <div className="modal-body">
              {verTodas.itens.map(l => <Linha key={l.id} l={l} mostrarDia />)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
