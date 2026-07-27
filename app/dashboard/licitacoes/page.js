'use client'
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { UFS } from '@/lib/pncpComum'
import { enviarAoGAS, lerBase64 } from '@/lib/gasClient'
import ModalChecklist from '@/components/ModalChecklist'
import ModalResultado from '@/components/ModalResultado'
import { nomeResultado, corResultado } from '@/lib/resultado'

const MODAL_NOMES = ['Pregão Eletrônico', 'Pregão Presencial', 'Concorrência Eletrônica',
  'Concorrência Presencial', 'Dispensa', 'Inexigibilidade']

const brParaInput = v => {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2})?/)
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00:00'}` : ''
}
const inputParaBr = v => {
  if (!v) return ''
  const [d, h] = String(v).split('T')
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}${h ? ' ' + h : ''}` : ''
}
const PART = { Sim: 'pill-green', 'Não': 'pill-red', Pendente: 'pill-amber' }

export default function LicitacoesPage() {
  const { usuario, empresaAtual, empresas } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfil === 'empresa'

  const [lics, setLics] = useState(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [aberta, setAberta] = useState(null)
  const [editando, setEditando] = useState(null)
  const [checklist, setChecklist] = useState(null)
  const [resultado, setResultado] = useState(null)

  const carregar = useCallback(() => {
    fetch('/api/licitacoes').then(r => r.json())
      .then(r => { r.sucesso ? setLics(r.licitacoes) : setErro(r.erro || 'Erro ao carregar.') })
      .catch(() => setErro('Erro de conexão.'))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!lics) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresaNome = empresaSel ? (empresas.find(e => String(e.id) === empresaSel)?.nome || '') : 'Todas as empresas'
  const base = empresaSel ? lics.filter(l => l.empresa_id === empresaSel) : lics

  const lista = base.filter(l => {
    if (status && l.status !== status) return false
    const q = busca.toLowerCase()
    if (q && ![l.objeto, l.orgao, l.numeroEdital, l.portal, l.uf].join(' ').toLowerCase().includes(q)) return false
    return true
  })

  const abertas = base.filter(l => l.status === 'Aberta').length
  const vaiParticipar = base.filter(l => l.participar === 'Sim').length

  async function decidir(lic, valor) {
    const r = await fetch('/api/licitacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto, participar: valor }),
    }).then(x => x.json())
    if (r.sucesso) carregar(); else alert(r.erro || 'Erro.')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Licitações</h2>
          <p className="sec-sub">{empresaNome}{somenteConsulta ? ' · modo consulta' : ''}</p>
        </div>
        {!somenteConsulta && empresaSel && (
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => setEditando({})}>+ Incluir licitação</button>
        )}
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-val kv-navy">{base.length}</div><div className="kpi-label">Licitações salvas</div></div>
        <div className="kpi"><div className="kpi-val kv-green">{abertas}</div><div className="kpi-label">Abertas</div></div>
        <div className="kpi"><div className="kpi-val kv-amber">{vaiParticipar}</div><div className="kpi-label">Vamos participar</div></div>
      </div>

      {!empresaSel && !somenteConsulta && (
        <div className="aviso-box">Selecione uma empresa no menu lateral para incluir licitações.</div>
      )}

      <div className="filtro-bar">
        <input className="busca-input" placeholder="Buscar por objeto, órgão, edital, portal..." value={busca} onChange={e => setBusca(e.target.value)} />
        {[['', 'Todas'], ['Aberta', 'Abertas'], ['Encerrada', 'Encerradas']].map(([k, l]) => (
          <button key={k} className={'filtro-btn' + (status === k ? ' active' : '')} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>

      {lista.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma licitação. Use Oportunidades para trazer do PNCP ou inclua manualmente.</div>}

      {lista.map(l => (
        <div key={l.id}>
          <div className="emp-card" style={{ cursor: 'pointer' }} onClick={() => setAberta(aberta === l.id ? null : l.id)}>
            <span className="emp-dot" style={{ background: l.status === 'Aberta' ? '#16A34A' : '#CBD5E1' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#1B2E4B', fontSize: 13.5 }}>{l.numeroEdital || 'Sem nº'} — {l.objeto?.slice(0, 90)}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                {l.empresa_nome}{l.orgao ? ' · ' + l.orgao : ''}{l.uf ? '/' + l.uf : ''}{l.portal ? ' · ' + l.portal : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {l.dataLimite && <span className="pill pill-gray">até {l.dataLimite.split(' ')[0]}</span>}
              {l.resultado && l.resultado !== 'Aguardando'
                ? <span className="pill" style={{ background: corResultado(l.resultado) + '22', color: corResultado(l.resultado) }}>{nomeResultado(l.resultado)}</span>
                : <span className={'pill ' + (PART[l.participar] || 'pill-gray')}>{l.participar}</span>}
            </div>
          </div>

          {aberta === l.id && (
            <div className="detalhe-card">
              <div className="detalhe-grid">
                {[['Órgão', l.orgao], ['UF', l.uf], ['Modalidade', l.modalidade], ['Portal', l.portal],
                  ['Nº PNCP', l.numeroPNCP], ['Valor estimado', l.valor], ['Abertura', l.dataAbertura],
                  ['Limite da proposta', l.dataLimite], ['SRP', l.srp], ['Status', l.status]]
                  .filter(x => x[1]).map(x => (
                    <div key={x[0]}><span className="dt-lbl">{x[0]}</span><span className="dt-val">{x[1]}</span></div>
                  ))}
              </div>
              {l.objeto && <p style={{ marginTop: 10 }}><strong>Objeto:</strong> {l.objeto}</p>}

              {l.resultado && l.resultado !== 'Aguardando' && (
                <div className="bloco-disputa" style={{ borderColor: corResultado(l.resultado) }}>
                  <strong style={{ color: corResultado(l.resultado) }}>🏁 {nomeResultado(l.resultado)}</strong>
                  {l.motivo && <div style={{ marginTop: 3 }}>Motivo: {l.motivo}</div>}
                  {(l.nossoLance || l.valorVencedor) && (
                    <div style={{ marginTop: 3 }}>
                      {l.nossoLance && <>Nosso lance: <strong>R$ {Number(l.nossoLance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></>}
                      {l.valorVencedor && <> · Vencedor: <strong>R$ {Number(l.valorVencedor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></>}
                      {l.empresaVencedora && <> ({l.empresaVencedora})</>}
                      {l.colocacao && <> · {l.colocacao}º lugar</>}
                    </div>
                  )}
                  {l.observacaoDisputa && <div style={{ marginTop: 5, fontStyle: 'italic' }}>{l.observacaoDisputa}</div>}
                </div>
              )}

              {l.itens.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table className="itens-tbl">
                    <thead><tr><th>Descrição</th><th>Qtd</th><th>Un</th><th style={{ textAlign: 'right' }}>Vl. unit. ref.</th></tr></thead>
                    <tbody>
                      {l.itens.map((it, i) => (
                        <tr key={i}>
                          <td style={{ maxWidth: 320 }}>{it.descricao}</td>
                          <td>{it.quantidade}</td><td>{it.unidade}</td>
                          <td style={{ textAlign: 'right' }}>{it.valorUnitarioRef ? 'R$ ' + Number(it.valorUnitarioRef).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="iBtn">↗ Abrir edital</a>}
                {l.anexoDriveUrl && <a href={l.anexoDriveUrl} target="_blank" rel="noreferrer" className="iBtn">📎 Anexo</a>}
                {!somenteConsulta && <>
                  <span style={{ fontSize: 11.5, color: '#64748B', marginLeft: 4 }}>Participar?</span>
                  {['Sim', 'Não', 'Pendente'].map(v => (
                    <button key={v} className={'iBtn' + (l.participar === v ? ' iBtn-up' : '')} onClick={() => decidir(l, v)}>{v}</button>
                  ))}
                  <button className="iBtn" onClick={() => setChecklist(l)}>📋 Checklist</button>
                  <button className="iBtn" onClick={() => setResultado(l)}>🏁 Resultado</button>
                  <button className="iBtn" onClick={() => setEditando(l)}>✏️ Editar</button>
                  <button className="iBtn iBtn-del" onClick={async () => {
                    if (!confirm('Excluir esta licitação?')) return
                    const r = await fetch('/api/licitacoes', {
                      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: l.id }),
                    }).then(x => x.json())
                    if (r.sucesso) { setAberta(null); carregar() } else alert(r.erro || 'Erro.')
                  }}>🗑</button>
                </>}
              </div>
            </div>
          )}
        </div>
      ))}

      {resultado && (
        <ModalResultado lic={resultado} onFechar={() => setResultado(null)}
          onSalvo={() => { setResultado(null); carregar() }} />
      )}

      {checklist && (
        <ModalChecklist lic={checklist} onFechar={() => setChecklist(null)}
          onSalvo={() => { setChecklist(null); carregar() }} />
      )}

      {editando && (
        <ModalLic lic={editando} empresaId={empresaSel || editando.empresa_id} empresaNome={empresaNome}
          onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar() }} />
      )}
    </div>
  )
}

function ModalLic({ lic, empresaId, empresaNome, onFechar, onSalvo }) {
  const ed = !!lic.id
  const [linkPncp, setLinkPncp] = useState('')
  const [extraindo, setExtraindo] = useState(false)
  const [f, setF] = useState({
    objeto: lic.objeto || '', numeroEdital: lic.numeroEdital || '', numeroPNCP: lic.numeroPNCP || '',
    modalidade: lic.modalidade || '', portal: lic.portal || '', uf: lic.uf || '', orgao: lic.orgao || '',
    valor: lic.valor || '', dataAbertura: brParaInput(lic.dataAbertura), dataLimite: brParaInput(lic.dataLimite),
    srp: lic.srp || 'Não', status: lic.status || 'Aberta', link: lic.link || '',
    anexoDriveId: lic.anexoDriveId || '', anexoDriveUrl: lic.anexoDriveUrl || '',
  })
  const [itens, setItens] = useState(lic.itens || [])
  const [anexoNome, setAnexoNome] = useState(lic.anexoDriveUrl ? 'edital anexado' : '')
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [salvando, setSalvando] = useState(false)

  const set = (k, v) => setF(o => ({ ...o, [k]: v }))

  async function extrair() {
    if (!linkPncp.trim()) { setErro('Cole o link do PNCP.'); return }
    setErro(''); setOk(''); setExtraindo(true)
    try {
      const r = await fetch('/api/licitacoes/extrair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: linkPncp.trim() }),
      }).then(x => x.json())
      if (!r.sucesso) setErro(r.erro || 'Não foi possível extrair.')
      else {
        const d = r.dados
        setF(o => ({
          ...o,
          objeto: d.objeto || o.objeto, numeroEdital: d.numeroEdital || o.numeroEdital,
          numeroPNCP: d.numeroPNCP || o.numeroPNCP, modalidade: d.modalidade || o.modalidade,
          portal: d.portal || o.portal, uf: d.uf || o.uf, orgao: d.orgao || o.orgao,
          valor: d.valorEstimado ? 'R$ ' + Number(d.valorEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : o.valor,
          dataAbertura: d.dataAberturaISO || o.dataAbertura, dataLimite: d.dataLimiteISO || o.dataLimite,
          srp: d.srp || o.srp, link: d.link || o.link,
        }))
        if (d.itens?.length) setItens(d.itens)
        setOk('Dados extraídos do PNCP — confira antes de salvar.')
      }
    } catch { setErro('Erro de conexão.') }
    setExtraindo(false)
  }

  async function onAnexo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { setErro('Arquivo muito grande (máx. 25 MB).'); return }
    setErro(''); setEnviandoAnexo(true)
    try {
      const base64 = await lerBase64(file)
      const r = await enviarAoGAS({
        action: 'uploadAnexoEdital',
        base64, mimeType: file.type || 'application/pdf', nomeArquivo: file.name, empresaNome,
      })
      if (r.ok) {
        set('anexoDriveId', r.driveFileId); set('anexoDriveUrl', r.driveFileUrl)
        setAnexoNome(file.name)
      } else setErro(r.erro || 'Falha ao anexar.')
    } catch (ex) { setErro(ex.message) }
    setEnviandoAnexo(false)
  }

  async function salvar() {
    if (!f.objeto.trim() && !f.numeroEdital.trim()) { setErro('Informe o objeto ou o nº do edital.'); return }
    setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/licitacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lic.id || null, empresa_id: empresaId, ...f,
          dataAbertura: inputParaBr(f.dataAbertura), dataLimite: inputParaBr(f.dataLimite),
          itensJson: JSON.stringify(itens.filter(it => String(it.descricao || '').trim())),
          origem: linkPncp ? 'pncp' : 'manual',
        }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo(); else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  const setItem = (i, k, v) => setItens(a => a.map((it, j) => j === i ? { ...it, [k]: v } : it))

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal modal-lg">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">LICITAÇÃO</div>
            <div className="modal-hdr-title">{ed ? 'Editar licitação' : 'Incluir licitação'}</div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">
          <div className="pncp-box">
            <label className="mini-lbl" style={{ color: '#1E40AF' }}>🔗 PREENCHIMENTO AUTOMÁTICO — LINK DO PNCP</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={linkPncp} onChange={e => setLinkPncp(e.target.value)} placeholder="https://pncp.gov.br/app/editais/..." />
              <button className="iBtn iBtn-up" style={{ flexShrink: 0, height: 36 }} onClick={extrair} disabled={extraindo}>
                {extraindo ? '...' : '🔍 Extrair'}
              </button>
            </div>
            {ok && <div style={{ marginTop: 8, fontSize: 12.5, color: '#166534', fontWeight: 600 }}>✅ {ok}</div>}
          </div>

          <div className="form-sub"><label>OBJETO</label><textarea rows={3} value={f.objeto} onChange={e => set('objeto', e.target.value)} /></div>

          <div className="form-grid">
            <div><label className="mini-lbl">Nº DO EDITAL</label><input value={f.numeroEdital} onChange={e => set('numeroEdital', e.target.value)} /></div>
            <div><label className="mini-lbl">MODALIDADE</label>
              <select value={f.modalidade} onChange={e => set('modalidade', e.target.value)}>
                <option value="">Selecione</option>{MODAL_NOMES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="mini-lbl">PORTAL DA DISPUTA</label><input value={f.portal} onChange={e => set('portal', e.target.value)} placeholder="ComprasNet, BLL..." /></div>
            <div><label className="mini-lbl">UF</label>
              <select value={f.uf} onChange={e => set('uf', e.target.value)}>
                <option value="">Selecione</option>{UFS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="mini-lbl">ÓRGÃO</label><input value={f.orgao} onChange={e => set('orgao', e.target.value)} /></div>
            <div><label className="mini-lbl">VALOR ESTIMADO</label><input value={f.valor} onChange={e => set('valor', e.target.value)} placeholder="R$ 0,00" /></div>
            <div><label className="mini-lbl">ABERTURA DAS PROPOSTAS</label><input type="datetime-local" value={f.dataAbertura} onChange={e => set('dataAbertura', e.target.value)} /></div>
            <div><label className="mini-lbl">LIMITE DA PROPOSTA</label><input type="datetime-local" value={f.dataLimite} onChange={e => set('dataLimite', e.target.value)} /></div>
            <div><label className="mini-lbl">SRP</label>
              <select value={f.srp} onChange={e => set('srp', e.target.value)}><option>Não</option><option>Sim</option></select>
            </div>
            <div><label className="mini-lbl">STATUS</label>
              <select value={f.status} onChange={e => set('status', e.target.value)}><option>Aberta</option><option>Encerrada</option></select>
            </div>
          </div>

          <div className="form-sub"><label>LINK DO EDITAL</label><input value={f.link} onChange={e => set('link', e.target.value)} /></div>

          <div className="form-sub">
            <label>📎 ANEXO DO EDITAL (PDF)</label>
            <label className={'uz' + (enviandoAnexo ? ' uploading' : anexoNome ? ' success' : '')} style={{ padding: 16 }}>
              <input type="file" accept=".pdf" onChange={onAnexo} disabled={enviandoAnexo} style={{ display: 'none' }} />
              {enviandoAnexo ? 'Enviando ao Drive...' : anexoNome ? '✅ ' + anexoNome + ' · clique para trocar' : '📄 Clique para anexar o PDF do edital (opcional, até 25 MB)'}
            </label>
          </div>

          <div className="form-sub">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ margin: 0 }}>ITENS DA LICITAÇÃO</label>
              <button className="iBtn" onClick={() => setItens(a => [...a, { descricao: '', quantidade: '', unidade: 'UN', valorUnitarioRef: '' }])}>+ Item</button>
            </div>
            {itens.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8', padding: 8, textAlign: 'center', background: '#F8FAFC', borderRadius: 8 }}>Nenhum item.</div>}
            {itens.map((it, i) => (
              <div className="item-row-lic" key={i}>
                <input placeholder="Descrição" value={it.descricao || ''} onChange={e => setItem(i, 'descricao', e.target.value)} />
                <input placeholder="Qtd" type="number" value={it.quantidade || ''} onChange={e => setItem(i, 'quantidade', e.target.value)} />
                <input placeholder="UN" value={it.unidade || ''} onChange={e => setItem(i, 'unidade', e.target.value)} />
                <input placeholder="Vl. unit." type="number" step="0.01" value={it.valorUnitarioRef || ''} onChange={e => setItem(i, 'valorUnitarioRef', e.target.value)} />
                <button className="iBtn iBtn-del" onClick={() => setItens(a => a.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>

          {erro && <div className="l-err" style={{ marginTop: 12 }}>{erro}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar licitação'}
          </button>
        </div>
      </div>
    </div>
  )
}
