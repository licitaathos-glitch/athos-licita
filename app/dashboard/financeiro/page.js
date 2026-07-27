'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { fmtBRL, STATUS_EMPENHO } from '@/lib/comercial'
import ModalEmpenho from '@/components/ModalEmpenho'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const CORES_STATUS = { Empenhado: '#3B82F6', Faturado: '#D97706', Entregue: '#8B5CF6', Pago: '#16A34A', Cancelado: '#94A3B8' }

const mesDe = dataBR => {
  const m = String(dataBR || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}` : ''
}

export default function FinanceiroPage() {
  const { usuario, empresaAtual, empresas } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfil === 'empresa'

  const [empenhos, setEmpenhos] = useState(null)
  const [configs, setConfigs] = useState({})
  const [erro, setErro] = useState('')
  const [status, setStatus] = useState('')
  const [editando, setEditando] = useState(null)

  const carregar = useCallback(() => {
    Promise.all([
      fetch('/api/empenhos').then(r => r.json()),
      fetch('/api/config-empresa').then(r => r.json()),
    ]).then(([e, c]) => {
      if (e.sucesso) setEmpenhos(e.empenhos); else setErro(e.erro || 'Erro ao carregar.')
      if (c.sucesso) setConfigs(c.configs)
    }).catch(() => setErro('Erro de conexão.'))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresaNome = empresaSel ? (empresas.find(e => String(e.id) === empresaSel)?.nome || '') : 'Todas as empresas'

  const base = useMemo(() => {
    if (!empenhos) return []
    const b = empresaSel ? empenhos.filter(e => e.empresa_id === empresaSel) : empenhos
    return b.filter(e => e.status !== 'Cancelado')
  }, [empenhos, empresaSel])

  const lista = status ? base.filter(e => e.status === status) : base

  const kpi = useMemo(() => {
    const soma = (arr, campo) => arr.reduce((s, e) => s + (e[campo] || 0), 0)
    const pagos = base.filter(e => e.status === 'Pago')
    const aReceber = base.filter(e => e.status !== 'Pago')
    return {
      faturamento: soma(base, 'faturamento'),
      receita: soma(base, 'receita'),
      recebido: soma(pagos, 'receita'),
      aReceber: soma(aReceber, 'receita'),
      faturadoAReceber: soma(aReceber, 'faturamento'),
      margemMedia: soma(base, 'faturamento') > 0 ? (soma(base, 'receita') / soma(base, 'faturamento')) * 100 : 0,
    }
  }, [base])

  // Últimos 6 meses
  const serie = useMemo(() => {
    const hoje = new Date()
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      meses.push({ chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, rotulo: MESES[d.getMonth()] })
    }
    return meses.map(m => {
      const doMes = base.filter(e => mesDe(e.dataEmpenho) === m.chave)
      return {
        ...m,
        faturamento: doMes.reduce((s, e) => s + e.faturamento, 0),
        receita: doMes.reduce((s, e) => s + e.receita, 0),
      }
    })
  }, [base])

  const maxSerie = Math.max(1, ...serie.map(s => s.faturamento))

  const porOrgao = useMemo(() => {
    const m = {}
    base.forEach(e => {
      const k = e.orgao || '—'
      if (!m[k]) m[k] = { orgao: k, faturamento: 0, receita: 0, qtd: 0 }
      m[k].faturamento += e.faturamento; m[k].receita += e.receita; m[k].qtd++
    })
    return Object.values(m).sort((a, b) => b.faturamento - a.faturamento).slice(0, 8)
  }, [base])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!empenhos) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const cfg = empresaSel ? (configs[empresaSel] || { modelo: 'revenda' }) : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Financeiro</h2>
          <p className="sec-sub">
            {empresaNome}
            {cfg && <> · {cfg.modelo === 'comissao' ? `comissão de ${cfg.percentualComissao || 0}%` : cfg.modelo === 'revenda' ? 'revenda (margem)' : 'venda direta'}</>}
          </p>
        </div>
        {!somenteConsulta && empresaSel && (
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => setEditando({})}>+ Lançar empenho</button>
        )}
      </div>

      <div className="kpi-grid kpi-4">
        <div className="kpi"><div className="kpi-val kv-navy" style={{ fontSize: 20 }}>{fmtBRL(kpi.faturamento)}</div><div className="kpi-label">Faturamento empenhado</div></div>
        <div className="kpi"><div className="kpi-val kv-green" style={{ fontSize: 20 }}>{fmtBRL(kpi.receita)}</div><div className="kpi-label">Minha receita ({kpi.margemMedia.toFixed(1)}%)</div></div>
        <div className="kpi"><div className="kpi-val kv-navy" style={{ fontSize: 20, color: '#16A34A' }}>{fmtBRL(kpi.recebido)}</div><div className="kpi-label">Já recebido</div></div>
        <div className="kpi"><div className="kpi-val kv-amber" style={{ fontSize: 20 }}>{fmtBRL(kpi.aReceber)}</div><div className="kpi-label">A receber</div></div>
      </div>

      {base.length === 0 && (
        <div className="aviso-box">
          Nenhum empenho lançado ainda. Lance a partir de <strong>Gestão de Atas</strong> (botão “+ Empenho” em cada ata) ou aqui mesmo — cada lançamento abate o saldo do item e alimenta este painel.
        </div>
      )}

      {base.length > 0 && (
        <>
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-title">📈 Últimos 6 meses</div>
            <div className="grafico">
              {serie.map(s => (
                <div className="graf-col" key={s.chave}>
                  <div className="graf-barras">
                    <div className="graf-b graf-fat" style={{ height: (s.faturamento / maxSerie * 100) + '%' }} title={'Faturamento ' + fmtBRL(s.faturamento)} />
                    <div className="graf-b graf-rec" style={{ height: (s.receita / maxSerie * 100) + '%' }} title={'Receita ' + fmtBRL(s.receita)} />
                  </div>
                  <div className="graf-rot">{s.rotulo}</div>
                </div>
              ))}
            </div>
            <div className="graf-legenda">
              <span><i className="graf-fat" /> Faturamento</span>
              <span><i className="graf-rec" /> Minha receita</span>
            </div>
          </div>

          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-title">🏛️ Por órgão</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="itens-tbl">
                <thead><tr>
                  <th>Órgão</th><th style={{ textAlign: 'center' }}>Empenhos</th>
                  <th style={{ textAlign: 'right' }}>Faturamento</th><th style={{ textAlign: 'right' }}>Minha receita</th>
                </tr></thead>
                <tbody>
                  {porOrgao.map(o => (
                    <tr key={o.orgao}>
                      <td style={{ maxWidth: 300 }}>{o.orgao}</td>
                      <td style={{ textAlign: 'center' }}>{o.qtd}</td>
                      <td style={{ textAlign: 'right' }}>{fmtBRL(o.faturamento)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>{fmtBRL(o.receita)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="filtro-bar">
            <button className={'filtro-btn' + (status === '' ? ' active' : '')} onClick={() => setStatus('')}>Todos</button>
            {STATUS_EMPENHO.filter(s => s !== 'Cancelado').map(s => (
              <button key={s} className={'filtro-btn' + (status === s ? ' active' : '')} onClick={() => setStatus(s)}>{s}</button>
            ))}
          </div>

          {lista.map(e => (
            <div className="emp-card" key={e.id}>
              <span className="emp-dot" style={{ background: CORES_STATUS[e.status] }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#1B2E4B', fontSize: 13 }}>
                  NE {e.numeroEmpenho}{e.itemDescricao ? ' — ' + e.itemDescricao.slice(0, 60) : ''}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {e.empresa_nome}{e.numeroAta ? ' · Ata ' + e.numeroAta : ''}{e.orgao ? ' · ' + e.orgao : ''}
                  {e.dataEmpenho ? ' · ' + e.dataEmpenho : ''}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3 }}>
                  {e.quantidade} un × {fmtBRL(e.valorUnitario)} = <strong>{fmtBRL(e.faturamento)}</strong>
                  {' · '}receita <strong style={{ color: '#16A34A' }}>{fmtBRL(e.receita)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <span className="pill" style={{ background: CORES_STATUS[e.status] + '22', color: CORES_STATUS[e.status] }}>{e.status}</span>
                {!somenteConsulta && <>
                  <button className="iBtn" onClick={() => setEditando(e)}>✏️</button>
                  <button className="iBtn iBtn-del" onClick={async () => {
                    if (!confirm('Excluir o empenho NE ' + e.numeroEmpenho + '?')) return
                    const r = await fetch('/api/empenhos', {
                      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: e.id }),
                    }).then(x => x.json())
                    if (r.sucesso) carregar(); else alert(r.erro || 'Erro.')
                  }}>🗑</button>
                </>}
              </div>
            </div>
          ))}
        </>
      )}

      {editando && (
        <ModalEmpenho
          empenho={editando}
          empresaId={empresaSel || editando.empresa_id}
          modelo={(configs[empresaSel || editando.empresa_id] || {}).modelo || 'revenda'}
          percentual={(configs[empresaSel || editando.empresa_id] || {}).percentualComissao}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar() }}
        />
      )}
    </div>
  )
}
