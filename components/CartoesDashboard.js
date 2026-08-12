'use client'
import { useState } from 'react'

// Cartão pequeno do Dashboard: número grande, três linhas de amostra e clique
// que abre a lista inteira numa janela — sem sair do Dashboard, que é o ponto:
// o Dashboard é o lugar de onde se enxerga tudo, não uma tela de passagem.
export function Cartao({ titulo, icone, total, cor = '#145653', vazio, linhas = [], onAbrir }) {
  return (
    <div className="form-card" onClick={total ? onAbrir : undefined}
      style={{ cursor: total ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', minHeight: 168 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 15 }}>{icone}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#145653' }}>{titulo}</span>
        <span style={{ marginLeft: 'auto', fontSize: 26, fontWeight: 800, color: total ? cor : '#CBD5E1', lineHeight: 1 }}>
          {total}
        </span>
      </div>

      <div style={{ flex: 1, marginTop: 8 }}>
        {total === 0
          ? <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{vazio}</p>
          : linhas.slice(0, 3).map((l, i) => (
            <div key={i} style={{ fontSize: 11.5, color: '#475569', padding: '3px 0', borderBottom: '1px solid #F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {l}
            </div>
          ))}
      </div>

      {total > 0 && (
        <div style={{ fontSize: 11.5, color: '#B9A06B', fontWeight: 700, marginTop: 6 }}>
          ver {total > 3 ? `todas as ${total}` : 'detalhes'} →
        </div>
      )}
    </div>
  )
}

// Janela genérica de lista, aberta a partir de um cartão
export function Janela({ titulo, subtitulo, onFechar, children }) {
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal modal-lg">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">DASHBOARD</div>
            <div className="modal-hdr-title">{titulo}</div>
            {subtitulo && <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>{subtitulo}</div>}
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// Linha clicável dentro de uma janela
export function LinhaJanela({ titulo, detalhe, extra, marcador, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 10px',
        borderRadius: 8, marginBottom: 6, cursor: onClick ? 'pointer' : 'default',
        background: hover && onClick ? '#F1F5F9' : '#F8FAFC',
        borderLeft: `3px solid ${marcador || '#CBD5E1'}`,
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2E2D2F' }}>{titulo}</div>
        {detalhe && <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{detalhe}</div>}
      </div>
      {extra && <div style={{ flexShrink: 0, fontSize: 11.5, color: '#64748B' }}>{extra}</div>}
    </div>
  )
}
