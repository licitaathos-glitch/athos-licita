'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'

const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#CBD5E1' }

function rotuloPrazo(c) {
  if (c.dias === null) return 'Sem validade'
  if (c.dias < 0) return 'Vencida há ' + Math.abs(c.dias) + ' dia' + (Math.abs(c.dias) > 1 ? 's' : '')
  if (c.dias === 0) return 'Vence hoje'
  return 'Vence em ' + c.dias + ' dia' + (c.dias > 1 ? 's' : '')
}

export default function CertidoesPage() {
  const { empresaAtual, empresas } = useApp()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => {
    fetch('/api/certidoes')
      .then(r => r.json())
      .then(r => { r.sucesso ? setDados(r.certidoes) : setErro(r.erro || 'Erro ao carregar.') })
      .catch(() => setErro('Erro de conexão.'))
  }, [])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  let lista = empresaAtual === 'todas' ? dados : dados.filter(c => c.empresa_id === String(empresaAtual))
  if (filtro === 'vencidas') lista = lista.filter(c => c.status === 'bad')
  if (filtro === 'alerta') lista = lista.filter(c => c.status === 'warn')

  const vencidas = (empresaAtual === 'todas' ? dados : dados.filter(c => c.empresa_id === String(empresaAtual))).filter(c => c.status === 'bad').length
  const alerta = (empresaAtual === 'todas' ? dados : dados.filter(c => c.empresa_id === String(empresaAtual))).filter(c => c.status === 'warn').length
  const empresaNome = empresaAtual === 'todas' ? 'Todas as empresas' : (empresas.find(e => String(e.id) === String(empresaAtual))?.nome || '')

  return (
    <div>
      <h2 className="sec-title">Certidões</h2>
      <p className="sec-sub">{empresaNome} · {lista.length} documento{lista.length !== 1 ? 's' : ''}</p>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-val kv-navy">{dados.length}</div><div className="kpi-label">Total de documentos</div></div>
        <div className="kpi"><div className="kpi-val kv-red">{vencidas}</div><div className="kpi-label">Vencidas</div></div>
        <div className="kpi"><div className="kpi-val kv-amber">{alerta}</div><div className="kpi-label">Vencem em 7 dias</div></div>
      </div>

      <div className="filtro-bar">
        {[['todas', 'Todas'], ['vencidas', 'Vencidas'], ['alerta', 'Alerta']].map(([k, l]) => (
          <button key={k} className={'filtro-btn' + (filtro === k ? ' active' : '')} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>

      {lista.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma certidão para exibir.</div>}

      {lista.map(c => (
        <div className="emp-card" key={c.id}>
          <span className="emp-dot" style={{ background: CORES[c.status] }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#1B2E4B' }}>{c.tipo}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              {c.empresa_nome}{c.validade ? ' · validade ' + c.validade : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <span className={'pill ' + (c.status === 'bad' ? 'pill-red' : c.status === 'warn' ? 'pill-amber' : c.status === 'ok' ? 'pill-green' : 'pill-gray')}>
              {rotuloPrazo(c)}
            </span>
            {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="link-doc">abrir</a>}
          </div>
        </div>
      ))}
    </div>
  )
}
