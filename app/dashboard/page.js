'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApp } from '@/lib/AppContext'
import CalendarioGeral from '@/components/CalendarioGeral'
import PainelTarefas from '@/components/PainelTarefas'
import PainelAgenda from '@/components/PainelAgenda'

const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#CBD5E1' }

export default function DashboardPage() {
  const { usuario, empresaAtual } = useApp()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(r => {
        if (r.sucesso) setDados(r)
        else setErro(r.erro || 'Erro ao carregar.')
      })
      .catch(() => setErro('Erro de conexão.'))
  }, [])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const perfil = String(usuario?.perfil || '').toLowerCase()
  const empresasFiltradas = empresaAtual === 'todas'
    ? dados.empresas
    : dados.empresas.filter(e => String(e.id) === String(empresaAtual))

  const totais = empresaAtual === 'todas' ? dados.totais : {
    empresas: empresasFiltradas.length,
    vencidas: empresasFiltradas.reduce((a, b) => a + b.vencidas, 0),
    alerta: empresasFiltradas.reduce((a, b) => a + b.alerta, 0),
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Dashboard</h2>
          <p className="sec-sub">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {perfil === 'adm' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/empresas" className="btn-ghost">+ Empresa</Link>
            <Link href="/dashboard/usuarios" className="btn-ghost">+ Usuário</Link>
          </div>
        )}
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-val kv-navy">{totais.empresas}</div><div className="kpi-label">Empresas {empresaAtual === 'todas' ? 'cadastradas' : 'em foco'}</div></div>
        <div className="kpi"><div className="kpi-val kv-red">{totais.vencidas}</div><div className="kpi-label">Certidões vencidas</div></div>
        <div className="kpi"><div className="kpi-val kv-amber">{totais.alerta}</div><div className="kpi-label">Vencem em 7 dias</div></div>
      </div>

      {/* O que acontece hoje e no resto da semana vem antes de tudo: é a
          pergunta que se faz ao abrir o sistema de manhã. */}
      <div style={{ marginBottom: 26 }}>
        <h3 className="sec-title" style={{ fontSize: 16 }}>⚖️ Licitações do dia e da semana</h3>
        <p className="sec-sub">Sessões, limites de proposta e aberturas — clique para abrir a licitação</p>
        <PainelAgenda />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#145653', marginBottom: 12 }}>📋 Status por empresa</div>
      {empresasFiltradas.length === 0 && (
        <div style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma empresa para exibir.</div>
      )}
      {empresasFiltradas.map(e => (
        <div className="emp-card" key={e.id}>
          <span className="emp-dot" style={{ background: CORES[e.status] }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#145653' }}>{e.nome}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>{e.cnpj}{e.responsavel ? ' · ' + e.responsavel : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {e.vencidas > 0 && <span className="pill pill-red">{e.vencidas} vencida{e.vencidas > 1 ? 's' : ''}</span>}
            {e.alerta > 0 && <span className="pill pill-amber">{e.alerta} alerta</span>}
            {e.vencidas === 0 && e.alerta === 0 && e.regulares > 0 && <span className="pill pill-green">Regular</span>}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 26 }}>
        <h3 className="sec-title" style={{ fontSize: 16 }}>✔️ Tarefas</h3>
        <p className="sec-sub">O que precisa ser feito — separado dos compromissos com hora marcada</p>
        <PainelTarefas />
      </div>

      <div style={{ marginTop: 26 }}>
        <h3 className="sec-title" style={{ fontSize: 16 }}>📅 Calendário e alertas</h3>
        <p className="sec-sub">Prazos, sessões, certidões, atas e pagamentos — clique para abrir o registro</p>
        <CalendarioGeral compacto />
      </div>
    </div>
  )
}
