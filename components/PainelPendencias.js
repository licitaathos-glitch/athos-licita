'use client'
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { paraData } from '@/lib/notificacoes'
import { tipoEventoInfo } from '@/lib/tiposEvento'
import ModalNovoRegistro from './ModalNovoRegistro'

const zerar = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

// Pendências do dia a dia — tarefas e eventos na mesma lista, no mesmo visual
// das linhas da agenda: barra colorida à esquerda, hora em destaque e a
// observação logo abaixo. Aqui também se exclui o que não vale mais.
export default function PainelPendencias({ aoMudar }) {
  const { usuario, empresaAtual } = useApp()
  const somenteConsulta = String(usuario?.perfil || '').toLowerCase() === 'empresa'
  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : ''

  const [tarefas, setTarefas] = useState(null)
  const [eventos, setEventos] = useState([])
  const [novo, setNovo] = useState(false)
  const [verFeitas, setVerFeitas] = useState(false)

  const carregar = useCallback(() => {
    fetch('/api/tarefas').then(r => r.json()).then(r => setTarefas(r.sucesso ? r.tarefas : [])).catch(() => setTarefas([]))
    fetch('/api/calendario/eventos').then(r => r.json()).then(r => r.sucesso && setEventos(r.eventos)).catch(() => {})
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function concluir(t) {
    setTarefas(l => l.map(x => (x.id === t.id ? { ...x, status: t.status === 'Concluída' ? 'Pendente' : 'Concluída' } : x)))
    await fetch('/api/tarefas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...t, status: t.status === 'Concluída' ? 'Pendente' : 'Concluída', concluidoEm: '' }),
    }).catch(() => {})
    carregar(); aoMudar?.()
  }

  async function excluir(item) {
    if (!confirm(`Excluir ${item.tipo === 'tarefa' ? 'a tarefa' : 'o evento'} "${item.titulo}"?`)) return
    try {
      if (item.tipo === 'tarefa') {
        await fetch(`/api/tarefas?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      } else {
        await fetch('/api/calendario/eventos', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        })
      }
      carregar(); aoMudar?.()
    } catch {}
  }

  if (!tarefas) return <div className="form-card"><p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Carregando...</p></div>

  const agora = new Date()
  const daEmpresa = x => !empresaSel || !x.empresaId || x.empresaId === empresaSel

  const itens = [
    ...tarefas.filter(daEmpresa).map(t => ({
      id: t.id, tipo: 'tarefa', bruto: t,
      icone: t.status === 'Concluída' ? '✅' : '✔️',
      titulo: t.titulo, obs: t.descricao || '',
      quando: paraData(t.prazo), empresaNome: t.empresaNome,
      marca: t.status === 'Concluída' ? '#94A3B8' : '#0F766E',
      etiqueta: t.prioridade, feita: t.status === 'Concluída',
    })),
    ...eventos.filter(daEmpresa).map(e => {
      const info = tipoEventoInfo(e.tipoEvento)
      const remarca = ['suspensao', 'remarcacao'].includes(e.tipoEvento)
      return {
        id: e.id, tipo: 'evento', bruto: e,
        icone: info.ico, titulo: e.titulo || info.nome, obs: e.descricao || '',
        quando: paraData(e.hora ? `${e.data}T${e.hora}` : e.data),
        empresaNome: e.empresaNome,
        marca: remarca ? '#B45309' : '#9333EA',
        etiqueta: 'evento', feita: false,
      }
    }),
  ]

  const pendentes = itens
    .filter(i => !i.feita && !(i.tipo === 'evento' && i.quando && i.quando < zerar(agora)))
    .sort((a, b) => (a.quando ? a.quando : Infinity) - (b.quando ? b.quando : Infinity))
  const arquivadas = itens.filter(i => i.feita || (i.tipo === 'evento' && i.quando && i.quando < zerar(agora)))

  const Linha = ({ i }) => {
    const atrasada = i.tipo === 'tarefa' && !i.feita && i.quando && i.quando < agora
    return (
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 10px',
        borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${atrasada ? '#DC2626' : i.marca}`,
        background: atrasada ? '#FEF2F2' : '#F8FAFC', opacity: i.feita ? .6 : 1,
      }}>
        {i.tipo === 'tarefa' && !somenteConsulta && (
          <input type="checkbox" checked={i.feita} onChange={() => concluir(i.bruto)} style={{ marginTop: 4 }} />
        )}
        {i.tipo === 'evento' && <span style={{ fontSize: 15, marginTop: 1 }}>{i.icone}</span>}

        <div style={{ minWidth: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: atrasada ? '#B91C1C' : '#145653' }}>
            {i.quando ? i.quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>
            {i.quando ? i.quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'sem prazo'}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2E2D2F', textDecoration: i.feita ? 'line-through' : 'none' }}>
            {i.titulo}
            {atrasada && <span className="pill pill-amber" style={{ marginLeft: 6 }}>atrasada</span>}
          </div>
          <div style={{ fontSize: 11.5, color: i.obs ? '#475569' : '#94A3B8', marginTop: 2 }}>
            <strong style={{ color: '#94A3B8' }}>Observação:</strong> {i.obs || 'sem observação'}
          </div>
          {i.empresaNome && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{i.empresaNome}</div>}
        </div>

        {!somenteConsulta && (
          <button className="iBtn iBtn-del" title="Excluir" onClick={() => excluir(i)}>×</button>
        )}
      </div>
    )
  }

  return (
    <div className="form-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#145653' }}>
          ✔️ Pendências ({pendentes.length})
        </div>
        {!somenteConsulta && <button className="iBtn iBtn-up" onClick={() => setNovo(true)}>+ Nova tarefa ou evento</button>}
      </div>

      {pendentes.length === 0
        ? <p style={{ fontSize: 12.5, color: '#94A3B8', margin: 0 }}>Nada pendente.</p>
        : pendentes.map(i => <Linha key={i.tipo + i.id} i={i} />)}

      {arquivadas.length > 0 && (
        <>
          <button className="iBtn" style={{ marginTop: 8 }} onClick={() => setVerFeitas(v => !v)}>
            {verFeitas ? 'ocultar' : `ver ${arquivadas.length} concluída(s) / passada(s)`}
          </button>
          {verFeitas && <div style={{ marginTop: 8 }}>{arquivadas.map(i => <Linha key={i.tipo + i.id} i={i} />)}</div>}
        </>
      )}

      {novo && (
        <ModalNovoRegistro
          empresaId={empresaSel}
          onFechar={() => setNovo(false)}
          onSalvo={() => { carregar(); aoMudar?.() }} />
      )}
    </div>
  )
}
