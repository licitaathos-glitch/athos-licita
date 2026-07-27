'use client'
import { useState } from 'react'
import { RESULTADOS, MOTIVOS_NAO_PARTICIPACAO, MOTIVOS_PERDA } from '@/lib/resultado'

export default function ModalResultado({ lic, onFechar, onSalvo }) {
  const [f, setF] = useState({
    resultado: lic.resultado || 'Aguardando',
    motivo: lic.motivo || '',
    nossoLance: lic.nossoLance || '',
    valorVencedor: lic.valorVencedor || '',
    empresaVencedora: lic.empresaVencedora || '',
    colocacao: lic.colocacao || '',
    observacaoDisputa: lic.observacaoDisputa || '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))

  const disputou = ['Ganhamos', 'Perdemos', 'Desclassificados'].includes(f.resultado)
  const motivos = f.resultado === 'Nao participamos' ? MOTIVOS_NAO_PARTICIPACAO
    : (f.resultado === 'Perdemos' || f.resultado === 'Desclassificados') ? MOTIVOS_PERDA : null

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const r = await fetch('/api/licitacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto, ...f,
          participar: f.resultado === 'Nao participamos' ? 'Não'
            : disputou ? 'Sim' : lic.participar,
          status: ['Ganhamos', 'Perdemos', 'Desclassificados', 'Deserta', 'Cancelada'].includes(f.resultado)
            ? 'Encerrada' : lic.status,
        }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo(); else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">RESULTADO DA DISPUTA</div>
            <div className="modal-hdr-title">{lic.numeroEdital || 'Licitação'}</div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>
              {String(lic.objeto || '').slice(0, 80)}
            </div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-sub">
            <label>COMO TERMINOU?</label>
            <div className="chip-group">
              {RESULTADOS.map(r => (
                <button key={r.id}
                  className={'chip-opt' + (f.resultado === r.id ? ' on' : '')}
                  onClick={() => { set('resultado', r.id); set('motivo', '') }}>{r.nome}</button>
              ))}
            </div>
          </div>

          {motivos && (
            <div className="form-sub">
              <label>MOTIVO {f.resultado === 'Nao participamos' ? 'DA NÃO PARTICIPAÇÃO' : 'DA PERDA'}</label>
              <select value={f.motivo} onChange={e => set('motivo', e.target.value)}>
                <option value="">Selecione</option>
                {motivos.map(m => <option key={m}>{m}</option>)}
              </select>
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 5 }}>
                O motivo padronizado é agrupado no relatório mensal do cliente.
              </p>
            </div>
          )}

          {disputou && (
            <div className="form-grid">
              <div><label className="mini-lbl">NOSSO LANCE FINAL (R$)</label>
                <input type="number" step="0.01" value={f.nossoLance} onChange={e => set('nossoLance', e.target.value)} /></div>
              <div><label className="mini-lbl">VALOR DO VENCEDOR (R$)</label>
                <input type="number" step="0.01" value={f.valorVencedor} onChange={e => set('valorVencedor', e.target.value)} /></div>
              <div><label className="mini-lbl">EMPRESA VENCEDORA</label>
                <input value={f.empresaVencedora} onChange={e => set('empresaVencedora', e.target.value)} placeholder={f.resultado === 'Ganhamos' ? 'Nossa empresa' : 'Concorrente'} /></div>
              <div><label className="mini-lbl">NOSSA COLOCAÇÃO</label>
                <input type="number" value={f.colocacao} onChange={e => set('colocacao', e.target.value)} placeholder="1" /></div>
            </div>
          )}

          <div className="form-sub">
            <label>COMO FOI A DISPUTA</label>
            <textarea rows={3} value={f.observacaoDisputa} onChange={e => set('observacaoDisputa', e.target.value)}
              placeholder="Nº de concorrentes, comportamento dos lances, recursos interpostos, o que aprendemos..." />
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 5 }}>
              Este texto entra no detalhamento do relatório mensal.
            </p>
          </div>

          {erro && <div className="l-err" style={{ marginTop: 12 }}>{erro}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar resultado'}
          </button>
        </div>
      </div>
    </div>
  )
}
