'use client'

// Interruptor simples (liga/desliga), reutilizado nas telas de itens
export default function Toggle({ ligado, onChange, label }) {
  return (
    <label className="toggle-wrap" onClick={e => { e.preventDefault(); onChange(!ligado) }}>
      <span className={'toggle-track' + (ligado ? ' on' : '')}><span className="toggle-knob" /></span>
      {label}
    </label>
  )
}
