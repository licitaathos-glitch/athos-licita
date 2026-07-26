'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#CBD5E1' }

export default function DashboardPage() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(r => {
        if (!r) return
        if (r.sucesso) setDados(r)
        else setErro(r.erro || 'Erro ao carregar.')
      })
      .catch(() => setErro('Erro de conexão.'))
  }, [router])

  async function sair() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const { usuario, totais, empresas } = dados

  return (
    <div>
      <div className="topbar">
        <div className="brand"><span className="ico">⚡</span> Athos Licita</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, opacity: .8 }}>{usuario?.nome?.split(' ')[0]}</span>
          <button onClick={sair}>Sair</button>
        </div>
      </div>
      <div className="main">
        <h2 className="sec-title">Dashboard</h2>
        <p className="sec-sub">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-val kv-navy">{totais.empresas}</div><div className="kpi-label">Empresas cadastradas</div></div>
          <div className="kpi"><div className="kpi-val kv-red">{totais.vencidas}</div><div className="kpi-label">Certidões vencidas (total)</div></div>
          <div className="kpi"><div className="kpi-val kv-amber">{totais.alerta}</div><div className="kpi-label">Vencem em 7 dias (total)</div></div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B2E4B', marginBottom: 12 }}>📋 Status por empresa</div>
        {empresas.map(e => (
          <div className="emp-card" key={e.id}>
            <span className="emp-dot" style={{ background: CORES[e.status] }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#1B2E4B' }}>{e.nome}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{e.cnpj}{e.responsavel ? ' · ' + e.responsavel : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {e.vencidas > 0 && <span className="pill pill-red">{e.vencidas} vencida{e.vencidas > 1 ? 's' : ''}</span>}
              {e.alerta > 0 && <span className="pill pill-amber">{e.alerta} alerta</span>}
              {e.vencidas === 0 && e.alerta === 0 && e.regulares > 0 && <span className="pill pill-green">Regular</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
