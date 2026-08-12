'use client'
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { paraData } from '@/lib/notificacoes'

const PRIORIDADES = ['Alta', 'Normal', 'Baixa']
const corPrioridade = p => (p === 'Alta' ? '#DC2626' : p === 'Baixa' ? '#94A3B8' : '#B9A06B')

// Tarefas soltas do dia a dia — separadas dos eventos de calendário, que são
// compromissos com hora marcada. Aqui é "o que precisa ser feito".
export default function PainelTarefas() {
  const { usuario, empresas, empresaAtual } = useApp()
  const somenteConsulta = String(usuario?.perfil || '').toLowerCase() === 'empresa'
  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : ''

  const [tarefas, setTarefas] = useState(null)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(false)
  const [verConcluidas, setVerConcluidas] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nova, setNova] = useState({ titulo: '', prazo: '', prioridade: 'Normal', empresaId: '' })

  const carregar = useCallback(() => {
    fetch('/api/tarefas').then(r => r.json())
      .then(r => (r.sucesso ? setTarefas(r.tarefas) : setErro(r.erro || 'Erro ao carregar tarefas.')))
      .catch(() => setErro('Erro de conexão.'))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    if (!nova.titulo.trim()) { setErro('Escreva o que precisa ser feito.'); return }
    setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/tarefas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nova, empresaId: nova.empresaId || empresaSel }),
      }).then(x => x.json())
      if (r.sucesso) {
        setNova({ titulo: '', prazo: '', prioridade: 'Normal', empresaId: '' })
        setAberto(false); carregar()
      } else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  async function alternarStatus(t) {
    const novoStatus = t.status === 'Concluída' ? 'Pendente' : 'Concluída'
    setTarefas(l => l.map(x => (x.id === t.id ? { ...x, status: novoStatus } : x)))
    try {
      await fetch('/api/tarefas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // concluidoEm vazio: a rota carimba a hora quando o status vira Concluída
        body: JSON.stringify({ ...t, status: novoStatus, concluidoEm: '' }),
      })
    } catch {}
    carregar()
  }

  async function excluir(t) {
    if (!confirm(`Excluir a tarefa "${t.titulo}"?`)) return
    try {
      await fetch(`/api/tarefas?id=${encodeURIComponent(t.id)}`, { method: 'DELETE' })
      carregar()
    } catch {}
  }

  if (!tarefas) return <div className="form-card"><p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Carregando tarefas...</p></div>

  const daEmpresa = empresaSel ? tarefas.filter(t => !t.empresaId || t.empresaId === empresaSel) : tarefas
  const pendentes = daEmpresa.filter(t => t.status !== 'Concluída')
  const concluidas = daEmpresa.filter(t => t.status === 'Concluída')
  const agora = new Date()
  const atrasadas = pendentes.filter(t => { const d = paraData(t.prazo); return d && d < agora }).length

  return (
    <div className="form-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ color: '#145653' }}>✔️ Tarefas</strong>
          <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>
            {pendentes.length} pendente(s){atrasadas > 0 && ` · ${atrasadas} atrasada(s)`}
          </span>
        </div>
        {!somenteConsulta && (
          <button className="iBtn" onClick={() => setAberto(a => !a)}>{aberto ? 'Fechar' : '+ Nova tarefa'}</button>
        )}
      </div>

      {aberto && !somenteConsulta && (
        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 10 }}>
          <div className="form-sub" style={{ marginTop: 0 }}>
            <label>O QUE PRECISA SER FEITO</label>
            <input value={nova.titulo} onChange={e => setNova(o => ({ ...o, titulo: e.target.value }))}
              placeholder="Ex: enviar impugnação do pregão 45/2026" />
          </div>
          <div className="filtro-linha">
            <div style={{ minWidth: 190 }}>
              <label className="mini-lbl">PRAZO (OPCIONAL)</label>
              <input type="datetime-local" value={nova.prazo} onChange={e => setNova(o => ({ ...o, prazo: e.target.value }))} />
            </div>
            <div style={{ minWidth: 130 }}>
              <label className="mini-lbl">PRIORIDADE</label>
              <select value={nova.prioridade} onChange={e => setNova(o => ({ ...o, prioridade: e.target.value }))}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label className="mini-lbl">EMPRESA (OPCIONAL)</label>
              <select value={nova.empresaId || empresaSel} onChange={e => setNova(o => ({ ...o, empresaId: e.target.value }))}>
                <option value="">Sem empresa</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" style={{ marginTop: 10 }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar tarefa'}
          </button>
        </div>
      )}

      {erro && <div className="l-err" style={{ marginTop: 10 }}>{erro}</div>}

      <div style={{ marginTop: 10 }}>
        {pendentes.length === 0 && (
          <p style={{ fontSize: 12.5, color: '#94A3B8', margin: '6px 0' }}>Nenhuma tarefa pendente.</p>
        )}
        {(verConcluidas ? [...pendentes, ...concluidas] : pendentes).map(t => {
          const prazo = paraData(t.prazo)
          const atrasada = t.status !== 'Concluída' && prazo && prazo < agora
          return (
            <div key={t.id} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0',
              borderBottom: '1px solid #F1F5F9', opacity: t.status === 'Concluída' ? .55 : 1,
            }}>
              <input type="checkbox" checked={t.status === 'Concluída'} disabled={somenteConsulta}
                onChange={() => alternarStatus(t)} style={{ marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#2E2D2F', textDecoration: t.status === 'Concluída' ? 'line-through' : 'none' }}>
                  {t.titulo}
                  <span className="pill" style={{ marginLeft: 6, background: corPrioridade(t.prioridade) + '22', color: corPrioridade(t.prioridade) }}>
                    {t.prioridade}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: atrasada ? '#B91C1C' : '#64748B', marginTop: 2 }}>
                  {prazo ? (atrasada ? '⚠️ venceu em ' : 'até ') + prazo.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sem prazo'}
                  {t.empresaNome ? ' · ' + t.empresaNome : ''}
                </div>
              </div>
              {!somenteConsulta && <button className="iBtn iBtn-del" onClick={() => excluir(t)}>×</button>}
            </div>
          )
        })}
        {concluidas.length > 0 && (
          <button className="iBtn" style={{ marginTop: 8 }} onClick={() => setVerConcluidas(v => !v)}>
            {verConcluidas ? 'ocultar concluídas' : `ver ${concluidas.length} concluída(s)`}
          </button>
        )}
      </div>
    </div>
  )
}
