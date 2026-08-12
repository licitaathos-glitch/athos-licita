'use client'
import { useState } from 'react'

const PRIORIDADES = ['Alta', 'Normal', 'Baixa']

// Janela pequena de "criar tarefa", usada a partir de qualquer lugar: do
// Dashboard, de uma empresa ou de dentro de uma licitação. Quando vem de uma
// licitação, já chega amarrada nela — o vínculo é o que faz a tarefa aparecer
// no lugar certo depois.
export default function ModalNovaTarefa({
  empresaId = '', empresaNome = '', licitacaoId = '', licitacaoEdital = '',
  tituloSugerido = '', onFechar, onSalvo,
}) {
  const [f, setF] = useState({
    titulo: tituloSugerido, prazo: '', prioridade: 'Normal', descricao: '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))

  async function salvar() {
    if (!f.titulo.trim()) { setErro('Escreva o que precisa ser feito.'); return }
    setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/tarefas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, empresaId, licitacaoId, licitacaoEdital }),
      }).then(x => x.json())
      if (r.sucesso) { onSalvo?.(); onFechar() }
      else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  const vinculo = [empresaNome, licitacaoEdital && 'Licitação ' + licitacaoEdital].filter(Boolean).join(' · ')

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">TAREFA</div>
            <div className="modal-hdr-title">Nova tarefa</div>
            {vinculo && (
              <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>{vinculo}</div>
            )}
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-sub" style={{ marginTop: 0 }}>
            <label>O QUE PRECISA SER FEITO</label>
            <input autoFocus value={f.titulo} onChange={e => set('titulo', e.target.value)}
              placeholder="Ex: pedir esclarecimento sobre o item 3" />
          </div>

          <div className="filtro-linha">
            <div style={{ minWidth: 190 }}>
              <label className="mini-lbl">PRAZO (OPCIONAL)</label>
              <input type="datetime-local" value={f.prazo} onChange={e => set('prazo', e.target.value)} />
            </div>
            <div style={{ minWidth: 130 }}>
              <label className="mini-lbl">PRIORIDADE</label>
              <select value={f.prioridade} onChange={e => set('prioridade', e.target.value)}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-sub">
            <label>OBSERVAÇÃO (OPCIONAL)</label>
            <textarea rows={2} value={f.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>

          <p className="dica-menus" style={{ marginTop: 0 }}>
            Com prazo preenchido, a tarefa entra no calendário e no sino de notificações.
          </p>

          {erro && <div className="l-err">{erro}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar tarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}
