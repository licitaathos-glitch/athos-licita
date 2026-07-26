'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'

const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#CBD5E1' }

function rotuloPrazo(a) {
  if (a.dias === null) return 'Sem vencimento'
  if (a.dias < 0) return 'Vencida'
  if (a.dias <= 30) return 'Vence em ' + a.dias + 'd'
  return 'Vigente'
}

export default function AtasPage() {
  const { empresaAtual, empresas } = useApp()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aberta, setAberta] = useState(null)

  useEffect(() => {
    fetch('/api/atas')
      .then(r => r.json())
      .then(r => { r.sucesso ? setDados(r.atas) : setErro(r.erro || 'Erro ao carregar.') })
      .catch(() => setErro('Erro de conexão.'))
  }, [])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const lista = empresaAtual === 'todas' ? dados : dados.filter(a => a.empresa_id === String(empresaAtual))
  const vencidas = lista.filter(a => a.status === 'bad').length
  const proximas = lista.filter(a => a.dias !== null && a.dias >= 0 && a.dias <= 30).length
  const empresaNome = empresaAtual === 'todas' ? 'Todas as empresas' : (empresas.find(e => String(e.id) === String(empresaAtual))?.nome || '')

  return (
    <div>
      <h2 className="sec-title">Gestão de Atas</h2>
      <p className="sec-sub">{empresaNome} · {lista.length} ata{lista.length !== 1 ? 's' : ''}</p>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-val kv-navy">{lista.length}</div><div className="kpi-label">Atas registradas</div></div>
        <div className="kpi"><div className="kpi-val kv-red">{vencidas}</div><div className="kpi-label">Vencidas</div></div>
        <div className="kpi"><div className="kpi-val kv-amber">{proximas}</div><div className="kpi-label">Vencem em 30 dias</div></div>
      </div>

      {lista.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma ata para exibir.</div>}

      {lista.map(a => (
        <div key={a.id}>
          <div className="emp-card" style={{ cursor: 'pointer' }} onClick={() => setAberta(aberta === a.id ? null : a.id)}>
            <span className="emp-dot" style={{ background: CORES[a.status] }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#1B2E4B' }}>Ata {a.numero}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                {a.empresa_nome}{a.orgao ? ' · ' + a.orgao : ''}{a.uf ? '/' + a.uf : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {a.itens > 0 && <span className="pill pill-gray">{a.itens} iten{a.itens > 1 ? 's' : ''}</span>}
              <span className={'pill ' + (a.status === 'bad' ? 'pill-red' : a.status === 'warn' ? 'pill-amber' : a.status === 'ok' ? 'pill-green' : 'pill-gray')}>
                {rotuloPrazo(a)}
              </span>
            </div>
          </div>
          {aberta === a.id && (
            <div className="detalhe-card">
              {a.objeto && <p><strong>Objeto:</strong> {a.objeto}</p>}
              {a.vigencia && <p><strong>Vigência:</strong> {a.vigencia}</p>}
              {a.vencimento && <p><strong>Vencimento:</strong> {a.vencimento}</p>}
              {a.adesao && <p><strong>Adesão:</strong> {a.adesao}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
