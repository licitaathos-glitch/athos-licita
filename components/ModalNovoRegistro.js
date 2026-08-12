'use client'
import { useState } from 'react'
import { TIPOS_EVENTO, tipoEventoInfo } from '@/lib/tiposEvento'

const PRIORIDADES = ['Alta', 'Normal', 'Baixa']

// Uma janela só para criar TAREFA ou EVENTO. Eram dois formulários quase
// iguais em lugares diferentes; a diferença real é o que cada um significa —
// tarefa é o que precisa ser feito, evento é um compromisso com hora marcada —
// e não justificava duas telas. A escolha fica no topo.
export default function ModalNovoRegistro({
  tipoInicial = 'tarefa',
  empresaId = '', empresaNome = '', licitacaoId = '', licitacaoEdital = '',
  dataInicial = '', onFechar, onSalvo,
}) {
  const [modo, setModo] = useState(tipoInicial)
  const [titulo, setTitulo] = useState('')
  const [quando, setQuando] = useState(dataInicial ? dataInicial + 'T09:00' : '')
  const [prioridade, setPrioridade] = useState('Normal')
  const [tipoEvento, setTipoEvento] = useState('reuniao')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const info = tipoEventoInfo(tipoEvento)
  const precisaTitulo = modo === 'tarefa' || tipoEvento === 'outro'

  async function salvar() {
    if (precisaTitulo && !titulo.trim()) {
      setErro(modo === 'tarefa' ? 'Escreva o que precisa ser feito.' : 'Dê um título para o evento.')
      return
    }
    if (modo === 'evento' && !quando) { setErro('Informe a data e hora do evento.'); return }
    setErro(''); setSalvando(true)
    try {
      let r
      if (modo === 'tarefa') {
        r = await fetch('/api/tarefas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: titulo.trim(), prazo: quando, prioridade, descricao,
            empresaId, licitacaoId, licitacaoEdital,
          }),
        }).then(x => x.json())
      } else {
        const [dia, horaDia] = quando.split('T')
        const nome = tipoEvento === 'outro' ? titulo.trim() : info.nome.split('(')[0].trim()
        r = await fetch('/api/calendario/eventos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: `${info.ico} ${nome}${licitacaoEdital ? ': ' + licitacaoEdital : ''}`,
            data: dia, hora: horaDia || '', descricao: descricao || info.nome, tipoEvento,
            empresaId, licitacaoId, licitacaoEdital,
          }),
        }).then(x => x.json())
      }
      if (r.sucesso) { onSalvo?.(); onFechar() }
      else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  const vinculo = [empresaNome, licitacaoEdital && 'Licitação ' + licitacaoEdital].filter(Boolean).join(' · ')
  const aba = ativo => ({
    flex: 1, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', textAlign: 'center',
    fontSize: 13, fontWeight: 700,
    border: '1.5px solid ' + (ativo ? '#145653' : '#E2E8F0'),
    background: ativo ? '#145653' : '#fff', color: ativo ? '#fff' : '#64748B',
  })

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">NOVO REGISTRO</div>
            <div className="modal-hdr-title">{modo === 'tarefa' ? 'Nova tarefa' : 'Novo evento'}</div>
            {vinculo && <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>{vinculo}</div>}
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={aba(modo === 'tarefa')} onClick={() => setModo('tarefa')}>✔️ Tarefa</div>
            <div style={aba(modo === 'evento')} onClick={() => setModo('evento')}>📅 Evento</div>
          </div>
          <p className="dica-menus" style={{ marginTop: 0 }}>
            {modo === 'tarefa'
              ? 'Algo que precisa ser feito. O prazo é opcional — com prazo, entra no calendário e no sino.'
              : 'Um compromisso com hora marcada: sessão, reunião, diligência, prazo de recurso.'}
          </p>

          {modo === 'evento' && (
            <div className="form-sub" style={{ marginTop: 0 }}>
              <label>TIPO DE EVENTO</label>
              <select value={tipoEvento} onChange={e => setTipoEvento(e.target.value)}>
                {TIPOS_EVENTO.map(t => <option key={t.id} value={t.id}>{t.ico} {t.nome}</option>)}
              </select>
            </div>
          )}

          {precisaTitulo && (
            <div className="form-sub">
              <label>{modo === 'tarefa' ? 'O QUE PRECISA SER FEITO' : 'TÍTULO DO EVENTO'}</label>
              <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder={modo === 'tarefa' ? 'Ex: pedir esclarecimento sobre o item 3' : 'Ex: visita técnica ao órgão'} />
            </div>
          )}

          <div className="filtro-linha">
            <div style={{ minWidth: 200 }}>
              <label className="mini-lbl">{modo === 'tarefa' ? 'PRAZO (OPCIONAL)' : 'DATA E HORA'}</label>
              <input type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} />
            </div>
            {modo === 'tarefa' && (
              <div style={{ minWidth: 130 }}>
                <label className="mini-lbl">PRIORIDADE</label>
                <select value={prioridade} onChange={e => setPrioridade(e.target.value)}>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="form-sub">
            <label>OBSERVAÇÃO (OPCIONAL)</label>
            <textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>

          {erro && <div className="l-err">{erro}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : (modo === 'tarefa' ? 'Salvar tarefa' : 'Salvar evento')}
          </button>
        </div>
      </div>
    </div>
  )
}
