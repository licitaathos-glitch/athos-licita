'use client'
import { useEffect, useState } from 'react'
import { CHECKLIST, avaliar } from '@/lib/checklist'

const CORES_VEREDITO = {
  descartar:  { bg: '#FEF2F2', bd: '#FECACA', cor: '#991B1B', ico: '⛔' },
  atencao:    { bg: '#FFFBEB', bd: '#FCD34D', cor: '#92400E', ico: '⚠️' },
  participar: { bg: '#F0FDF4', bd: '#BBF7D0', cor: '#166534', ico: '✅' },
  incompleto: { bg: '#F8FAFC', bd: '#E2E8F0', cor: '#64748B', ico: '📋' },
}

export default function ModalChecklist({ lic, onFechar, onSalvo }) {
  const [dados, setDados] = useState(() => {
    try { return JSON.parse(lic.checklistJson || '{}') } catch { return {} }
  })
  const [decisao, setDecisao] = useState(lic.participar || 'Pendente')
  const [obs, setObs] = useState(() => {
    try { return (JSON.parse(lic.checklistJson || '{}')._obs) || '' } catch { return '' }
  })
  const [certAlerta, setCertAlerta] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Confere as certidões da empresa contra a data da sessão
  useEffect(() => {
    fetch('/api/certidoes').then(r => r.json()).then(r => {
      if (!r.sucesso) return
      const daEmpresa = r.certidoes.filter(c => c.empresa_id === lic.empresa_id && c.tem_validade)
      const vencidas = daEmpresa.filter(c => c.status === 'bad')
      const alerta = daEmpresa.filter(c => c.status === 'warn')
      setCertAlerta({ total: daEmpresa.length, vencidas, alerta })
    }).catch(() => {})
  }, [lic.empresa_id])

  const resultado = avaliar(dados)
  const est = CORES_VEREDITO[resultado.veredito]

  const responder = (k, v) => setDados(d => ({ ...d, [k]: { ...(d[k] || {}), resposta: v } }))
  const detalhar = (k, v) => setDados(d => ({ ...d, [k]: { ...(d[k] || {}), detalhe: v } }))

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const r = await fetch('/api/licitacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lic.id, empresa_id: lic.empresa_id || lic.empresaId, objeto: lic.objeto,
          checklistJson: JSON.stringify({ ...dados, _obs: obs, _veredito: resultado.veredito }),
          participar: decisao,
          // A decisão no checklist já move o cartão de fase
          fase: decisao === 'Sim' ? 'Inscricao' : decisao === 'Não' ? 'Descartado' : (lic.fase || 'Em analise'),
        }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo(); else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal modal-lg">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">CHECKLIST DE VIABILIDADE</div>
            <div className="modal-hdr-title">{lic.numeroEdital || 'Licitação'}</div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>
              {String(lic.objeto || '').slice(0, 90)}
            </div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>

        <div className="modal-body">
          <div className="veredito" style={{ background: est.bg, borderColor: est.bd, color: est.cor }}>
            <div style={{ fontSize: 22 }}>{est.ico}</div>
            <div>
              <strong>{resultado.titulo}</strong>
              <div style={{ fontSize: 12, marginTop: 2 }}>{resultado.motivo}</div>
              <div className="progresso"><span style={{ width: (resultado.respondidos / resultado.total * 100) + '%' }} /></div>
            </div>
          </div>

          {certAlerta && (certAlerta.vencidas.length > 0 || certAlerta.alerta.length > 0) && (
            <div className="aviso-box" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}>
              <strong>Atenção às certidões desta empresa:</strong>
              {certAlerta.vencidas.length > 0 && <div>⛔ {certAlerta.vencidas.length} vencida(s): {certAlerta.vencidas.map(c => c.tipo).join(', ')}</div>}
              {certAlerta.alerta.length > 0 && <div>⚠️ {certAlerta.alerta.length} vence(m) em até 7 dias: {certAlerta.alerta.map(c => c.tipo).join(', ')}</div>}
            </div>
          )}

          {CHECKLIST.map(sec => (
            <div key={sec.secao} style={{ marginTop: 18 }}>
              <div className="chk-secao">
                {sec.secao}
                <span>{sec.desc}</span>
              </div>
              {sec.itens.map(it => {
                const r = dados[it.k]?.resposta || ''
                const reprovado = resultado.reprovados.includes(it.k)
                return (
                  <div className={'chk-item' + (reprovado ? ' reprovado' : '')} key={it.k}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div className="chk-titulo">
                        {it.label}
                        {it.eliminatorio && <span className="tag-elim">eliminatório</span>}
                      </div>
                      <div className="chk-pergunta">{it.pergunta}</div>
                      <div className="chk-ajuda">{it.ajuda}</div>
                      <input className="chk-detalhe-input" placeholder="Anotação (o que o edital diz, nº da cláusula...)"
                        value={dados[it.k]?.detalhe || ''} onChange={e => detalhar(it.k, e.target.value)} />
                    </div>
                    <div className="chk-sn">
                      {[['S', 'Sim'], ['N', 'Não'], ['NA', 'N/A']].map(([v, l]) => (
                        <button key={v} className={'chk-btn' + (r === v ? ' ' + (v === 'N' ? 'n' : 's') : '')}
                          onClick={() => responder(it.k, v)}>{l}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          <div className="form-sub" style={{ marginTop: 18 }}>
            <label>OBSERVAÇÕES GERAIS</label>
            <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Estratégia de lance, preço-alvo, riscos..." />
          </div>

          <div className="form-sub">
            <label>DECISÃO DE PARTICIPAÇÃO</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['Sim', '✅ Participar → Inscrição de proposta'], ['Não', '❌ Não participar → Descartado'], ['Pendente', '⏳ Pendente']].map(([v, l]) => (
                <button key={v} className={'dec-btn' + (decisao === v ? ' on' : '')} onClick={() => setDecisao(v)}>{l}</button>
              ))}
            </div>
          </div>

          {erro && <div className="l-err" style={{ marginTop: 12 }}>{erro}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar checklist'}
          </button>
        </div>
      </div>
    </div>
  )
}
