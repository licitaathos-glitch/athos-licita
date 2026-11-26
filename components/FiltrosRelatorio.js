'use client'
import { FAIXAS, FAIXAS_PADRAO, mesPeriodo } from '@/lib/relatorio'

// Filtros do relatório: período (mês pronto ou datas livres), quais fases entram
// e quais seções extras acompanham as fichas. `setF` recebe só o que mudou.
export default function FiltrosRelatorio({ filtros, setF, opcoesMes }) {
  const ordem = FAIXAS.map(f => f.id)
  const alternarFase = id => {
    const marcadas = new Set(filtros.fases)
    if (marcadas.has(id)) marcadas.delete(id); else marcadas.add(id)
    setF({ fases: ordem.filter(x => marcadas.has(x)) })
  }
  const link = { background: 'none', border: 'none', color: '#145653', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }

  return (
    <div className="form-card">
      <div className="filtro-linha">
        <div>
          <label className="mini-lbl">PERÍODO</label>
          <select value={filtros.mesSel} onChange={e => { const v = e.target.value; if (v !== 'custom') setF({ mesSel: v, ...mesPeriodo(v) }) }}>
            {opcoesMes.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            <option value="custom">Personalizado</option>
          </select>
        </div>
        <div>
          <label className="mini-lbl">DE</label>
          <input type="date" value={filtros.de} onChange={e => setF({ de: e.target.value, mesSel: 'custom' })} />
        </div>
        <div>
          <label className="mini-lbl">ATÉ</label>
          <input type="date" value={filtros.ate} onChange={e => setF({ ate: e.target.value, mesSel: 'custom' })} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14, gap: 12, flexWrap: 'wrap' }}>
        <label className="mini-lbl" style={{ margin: 0 }}>FASES NO RELATÓRIO</label>
        <span style={{ display: 'flex', gap: 14 }}>
          <button type="button" style={link} onClick={() => setF({ fases: ordem })}>todas</button>
          <button type="button" style={link} onClick={() => setF({ fases: FAIXAS_PADRAO })}>padrão (sem Excluída)</button>
          <button type="button" style={link} onClick={() => setF({ fases: [] })}>nenhuma</button>
        </span>
      </div>
      <div className="rel-filtro-fases">
        {FAIXAS.map(f => (
          <label key={f.id} className="rel-chk">
            <input type="checkbox" checked={filtros.fases.includes(f.id)} onChange={() => alternarFase(f.id)} />
            <span className="rel-chk-dot" style={{ background: f.cor }} />{f.nome}
          </label>
        ))}
      </div>

      <div className="rel-filtro-fases" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
        <label className="rel-chk">
          <input type="checkbox" checked={filtros.incluirAnteriores} onChange={e => setF({ incluirAnteriores: e.target.checked })} />
          Incluir o que segue em andamento de períodos anteriores
        </label>
        <label className="rel-chk">
          <input type="checkbox" checked={filtros.mostrarFinanceiro} onChange={e => setF({ mostrarFinanceiro: e.target.checked })} />
          Resultado financeiro
        </label>
        <label className="rel-chk">
          <input type="checkbox" checked={filtros.mostrarAtas} onChange={e => setF({ mostrarAtas: e.target.checked })} />
          Atas e contratos
        </label>
      </div>
    </div>
  )
}
