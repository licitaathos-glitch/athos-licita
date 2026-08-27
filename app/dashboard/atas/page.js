'use client'
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { enviarAoGAS, lerBase64 } from '@/lib/gasClient'
import VisualizadorArquivo from '@/components/VisualizadorArquivo'
import { saldoDoItem, fmtBRL as fmtB } from '@/lib/comercial'
import ModalEmpenho from '@/components/ModalEmpenho'

const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#CBD5E1' }
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// Separa e-mail e telefone de um texto livre como "fulano@x.gov.br / (11) 9999-9999"
const extrairEmail = t => (String(t || '').match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0]
const extrairTelefone = t => (String(t || '').match(/\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}/) || [''])[0]

const fmtMoeda = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const brParaISO = v => { const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : '' }
const isoParaBR = v => { const p = String(v || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '' }

function situacao(a) {
  if (a.dias === null) return { txt: 'Indefinida', cls: 'pill-gray' }
  if (a.dias < 0) return { txt: 'Vencida', cls: 'pill-red' }
  if (a.dias <= 60) return { txt: 'Vence em ' + a.dias + 'd', cls: 'pill-amber' }
  return { txt: 'Vigente', cls: 'pill-green' }
}

export default function AtasPage() {
  const { usuario, empresaAtual, empresas } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfil === 'empresa'

  const [atas, setAtas] = useState(null)
  const [empenhos, setEmpenhos] = useState([])
  const [configs, setConfigs] = useState({})
  const [novoEmpenho, setNovoEmpenho] = useState(null)
  const [verArquivo, setVerArquivo] = useState(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [aberta, setAberta] = useState(null)
  const [editando, setEditando] = useState(null)

  const carregar = useCallback(() => {
    Promise.all([
      fetch('/api/atas').then(r => r.json()),
      fetch('/api/empenhos').then(r => r.json()),
      fetch('/api/config-empresa').then(r => r.json()),
    ]).then(([a, e, c]) => {
      if (a.sucesso) setAtas(a.atas); else setErro(a.erro || 'Erro ao carregar.')
      if (e.sucesso) setEmpenhos(e.empenhos)
      if (c.sucesso) setConfigs(c.configs)
    }).catch(() => setErro('Erro de conexão.'))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!atas) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresaNome = empresaSel ? (empresas.find(e => String(e.id) === empresaSel)?.nome || '') : 'Todas as empresas'
  const base = empresaSel ? atas.filter(a => a.empresa_id === empresaSel) : atas

  const lista = base.filter(a => {
    if (filtro === 'vigente' && !(a.dias !== null && a.dias > 60)) return false
    if (filtro === 'vencendo' && !(a.dias !== null && a.dias >= 0 && a.dias <= 60)) return false
    if (filtro === 'vencida' && !(a.dias !== null && a.dias < 0)) return false
    const q = busca.toLowerCase()
    if (q && ![a.numeroAta, a.orgao, a.objeto, a.uf, a.licitacao].join(' ').toLowerCase().includes(q)) return false
    return true
  })

  const valorTotal = base.reduce((s, a) => s + a.valorTotal, 0)
  const vencendo = base.filter(a => a.dias !== null && a.dias >= 0 && a.dias <= 60).length
  const vencidas = base.filter(a => a.dias !== null && a.dias < 0).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Gestão de Atas</h2>
          <p className="sec-sub">{empresaNome} · Atas de Registro de Preços{somenteConsulta ? ' · modo consulta' : ''}</p>
        </div>
        {!somenteConsulta && empresaSel && (
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => setEditando({})}>+ Incluir ata</button>
        )}
      </div>

      <div className="kpi-grid kpi-4">
        <div className="kpi"><div className="kpi-val kv-navy">{base.length}</div><div className="kpi-label">Atas cadastradas</div></div>
        <div className="kpi"><div className="kpi-val kv-green" style={{ fontSize: 20 }}>{fmtMoeda(valorTotal)}</div><div className="kpi-label">Valor registrado</div></div>
        <div className="kpi"><div className="kpi-val kv-amber">{vencendo}</div><div className="kpi-label">Vencem em 60 dias</div></div>
        <div className="kpi"><div className="kpi-val kv-red">{vencidas}</div><div className="kpi-label">Vencidas</div></div>
      </div>

      {!empresaSel && !somenteConsulta && (
        <div className="aviso-box">Selecione uma empresa no menu lateral para incluir uma nova ata.</div>
      )}

      <div className="filtro-bar">
        <input className="busca-input" placeholder="Buscar por nº, órgão, objeto, UF..." value={busca} onChange={e => setBusca(e.target.value)} />
        {[['', 'Todas'], ['vigente', 'Vigentes'], ['vencendo', 'Vencendo'], ['vencida', 'Vencidas']].map(([k, l]) => (
          <button key={k} className={'filtro-btn' + (filtro === k ? ' active' : '')} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>

      {lista.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma ata para exibir.</div>}

      {lista.map(a => {
        const sit = situacao(a)
        return (
          <div key={a.id}>
            <div className="emp-card" style={{ cursor: 'pointer' }} onClick={() => setAberta(aberta === a.id ? null : a.id)}>
              <span className="emp-dot" style={{ background: CORES[a.status] }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#145653', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Ata {a.numeroAta}
                  {a.arquivoUrl && (
                    <button className="iBtn" title="Ver e baixar o PDF da ata"
                      onClick={ev => { ev.stopPropagation(); setVerArquivo({ url: a.arquivoUrl, nome: a.arquivoNome || `Ata ${a.numeroAta}` }) }}>
                      📄
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {a.empresa_nome}{a.orgao ? ' · ' + a.orgao : ''}{a.uf ? '/' + a.uf : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {a.itens.length > 0 && <span className="pill pill-gray">{a.itens.length} iten{a.itens.length > 1 ? 's' : ''}</span>}
                <span className={'pill ' + sit.cls}>{sit.txt}</span>
              </div>
            </div>

            {aberta === a.id && (
              <div className="detalhe-card">
                <div className="detalhe-grid">
                  {[['Órgão', a.orgao], ['CNPJ do órgão', a.cnpjOrgao], ['Licitação de origem', a.licitacao],
                    ['Processo', a.processo], ['Representante', a.representante], ['Assinatura', a.dataAssinatura],
                    ['Vigência', a.vigencia], ['Vencimento', a.vencimento], ['Adesão', a.adesao],
                    ['Pagamento', a.condPagamento], ['E-mail do órgão', a.emailOrgao], ['Telefone do órgão', a.telefoneOrgao], ['Contato (registro antigo)', a.contato]]
                    .filter(x => x[1]).map(x => (
                      <div key={x[0]}><span className="dt-lbl">{x[0]}</span><span className="dt-val">{x[1]}</span></div>
                    ))}
                </div>
                {a.objeto && <p style={{ marginTop: 10 }}><strong>Objeto:</strong> {a.objeto}</p>}
                {a.observacoes && <div className="obs-box">{a.observacoes}</div>}

                {a.itens.length > 0 && (() => {
                  const empDaAta = empenhos.filter(e => e.ataId === a.id)
                  return (
                    <div style={{ overflowX: 'auto', marginTop: 12 }}>
                      <table className="itens-tbl">
                        <thead><tr>
                          <th>Item</th><th>Descrição</th><th>Marca</th><th>Un</th>
                          <th style={{ textAlign: 'right' }}>Registrado</th><th style={{ textAlign: 'right' }}>Vl. Unit.</th>
                          <th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Empenhado</th>
                          <th style={{ textAlign: 'right' }}>Saldo</th>
                        </tr></thead>
                        <tbody>
                          {a.itens.map((it, i) => {
                            const sd = saldoDoItem(it, empDaAta)
                            const vu = Number(it.valorUnitario) || 0
                            return (
                              <tr key={i}>
                                <td>{it.item || '—'}</td>
                                <td style={{ maxWidth: 240 }}>{it.descricao || '—'}</td>
                                <td>{it.marca || '—'}</td><td>{it.unidade || '—'}</td>
                                <td style={{ textAlign: 'right' }}>{sd.registrado.toLocaleString('pt-BR')}</td>
                                <td style={{ textAlign: 'right' }}>{fmtMoeda(vu)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoeda(sd.registrado * vu)}</td>
                                <td style={{ textAlign: 'right' }}>{sd.empenhado.toLocaleString('pt-BR')}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: sd.saldo > 0 ? '#16A34A' : '#DC2626' }}>
                                  {sd.saldo.toLocaleString('pt-BR')}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      {empDaAta.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#145653', marginBottom: 6 }}>
                            📄 Empenhos desta ata ({empDaAta.length})
                          </div>
                          <table className="itens-tbl">
                            <thead><tr>
                              <th>Nº Empenho</th><th>Data</th><th>Item</th>
                              <th style={{ textAlign: 'right' }}>Qtd</th>
                              <th style={{ textAlign: 'right' }}>Faturamento</th>
                              <th style={{ textAlign: 'right' }}>Receita</th><th>Situação</th>
                            </tr></thead>
                            <tbody>
                              {empDaAta.map(e => (
                                <tr key={e.id}>
                                  <td style={{ fontWeight: 700 }}>{e.numeroEmpenho}</td>
                                  <td>{e.dataEmpenho || '—'}</td>
                                  <td>{e.itemNumero || '—'}</td>
                                  <td style={{ textAlign: 'right' }}>{e.quantidade}</td>
                                  <td style={{ textAlign: 'right' }}>{fmtB(e.faturamento)}</td>
                                  <td style={{ textAlign: 'right', color: '#16A34A', fontWeight: 700 }}>{fmtB(e.receita)}</td>
                                  <td>{e.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {!somenteConsulta && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {a.arquivoUrl && (
                      <button className="iBtn" onClick={() => setVerArquivo({ url: a.arquivoUrl, nome: a.arquivoNome || `Ata ${a.numeroAta}` })}>
                        📄 Ver ata
                      </button>
                    )}
                    <button className="iBtn iBtn-up" onClick={() => setNovoEmpenho(a)}>+ Empenho</button>
                    <button className="iBtn" onClick={() => setEditando(a)}>✏️ Editar</button>
                    <button className="iBtn iBtn-del" onClick={async () => {
                      if (!confirm('Excluir a ata ' + a.numeroAta + '?')) return
                      const r = await fetch('/api/atas', {
                        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: a.id }),
                      }).then(x => x.json())
                      if (r.sucesso) { setAberta(null); carregar() } else alert(r.erro || 'Erro.')
                    }}>🗑 Excluir</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {novoEmpenho && (
        <ModalEmpenho
          ata={novoEmpenho}
          empresaId={novoEmpenho.empresa_id}
          modelo={(configs[novoEmpenho.empresa_id] || {}).modelo || 'revenda'}
          percentual={(configs[novoEmpenho.empresa_id] || {}).percentualComissao}
          itensDisponiveis={novoEmpenho.itens.map(it => ({
            ...it,
            ...saldoDoItem(it, empenhos.filter(e => e.ataId === novoEmpenho.id)),
          }))}
          onFechar={() => setNovoEmpenho(null)}
          onSalvo={() => { setNovoEmpenho(null); carregar() }}
        />
      )}

      {verArquivo && (
        <VisualizadorArquivo url={verArquivo.url} nome={verArquivo.nome} onFechar={() => setVerArquivo(null)} />
      )}

      {editando && (
        <ModalAta
          ata={editando}
          empresaId={empresaSel || editando.empresa_id}
          empresaNome={editando.empresa_nome || empresaNome}
          licitacaoIdsComAta={atas.filter(a => a.licitacaoId && a.id !== editando.id).map(a => a.licitacaoId)}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar() }}
        />
      )}
    </div>
  )
}

function ModalAta({ ata, empresaId, empresaNome, licitacaoIdsComAta = [], onFechar, onSalvo }) {
  const ed = !!ata.id
  const [f, setF] = useState({
    numeroAta: ata.numeroAta || '', uf: ata.uf || '', orgao: ata.orgao || '', cnpjOrgao: ata.cnpjOrgao || '',
    licitacao: ata.licitacao || '', processo: ata.processo || '', objeto: ata.objeto || '',
    representante: ata.representante || '', dataAssinatura: brParaISO(ata.dataAssinatura),
    vigencia: ata.vigencia || '', vencimento: brParaISO(ata.vencimento), adesao: ata.adesao || '',
    condPagamento: ata.condPagamento || '', contato: ata.contato || '', observacoes: ata.observacoes || '',
    emailOrgao: ata.emailOrgao || '', telefoneOrgao: ata.telefoneOrgao || '',
    licitacaoId: ata.licitacaoId || '',
  })
  const [itens, setItens] = useState(ata.itens || [])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [lendoPdf, setLendoPdf] = useState(false)
  const [pdfNome, setPdfNome] = useState('')
  const [ganhas, setGanhas] = useState(null)

  const set = (k, v) => setF(o => ({ ...o, [k]: v }))

  useEffect(() => {
    fetch('/api/licitacoes').then(r => r.json()).then(r => {
      if (!r.sucesso) { setGanhas([]); return }
      setGanhas(r.licitacoes.filter(l =>
        String(l.empresa_id) === String(empresaId) &&
        (l.fase === 'Finalizada' || l.fase === 'Finalizado') && l.resultado === 'Ganhamos' &&
        // já tem ata vinculada em outro registro — some da lista pra não
        // deixar linkar (e duplicar) a mesma licitação de novo
        !licitacaoIdsComAta.includes(l.id)
      ))
    }).catch(() => setGanhas([]))
  }, [empresaId])

  function vincularLicitacao(id) {
    if (!id) { set('licitacaoId', ''); return }
    const l = ganhas.find(x => x.id === id)
    if (!l) return
    setF(o => ({
      ...o,
      licitacaoId: id,
      licitacao: [l.modalidade, l.srp === 'Sim' ? 'SRP' : '', l.numeroEdital ? 'nº ' + l.numeroEdital : ''].filter(Boolean).join(' ') || o.licitacao,
      processo: l.numeroPNCP || o.processo,
      objeto: l.objeto || o.objeto,
      orgao: l.orgao || o.orgao,
      uf: l.uf || o.uf,
    }))
  }

  async function onPdf(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { setErro('Arquivo muito grande (máx. 25 MB).'); return }
    setErro(''); setLendoPdf(true)
    try {
      const base64 = await lerBase64(file)
      const r = await enviarAoGAS({
        action: 'extrairDadosAta',
        base64, mimeType: file.type || 'application/pdf',
      })
      // Guarda o PDF no Drive junto com a leitura — antes o arquivo era lido
      // pela IA e descartado, e depois não havia como rever nem baixar a ata.
      let arquivo = {}
      try {
        const up = await enviarAoGAS({
          action: 'uploadAnexoEdital',
          base64, mimeType: file.type || 'application/pdf',
          nomeArquivo: file.name, empresaNome: empresaNome || '',
        })
        if (up.sucesso && up.driveFileUrl) arquivo = { arquivoUrl: up.driveFileUrl, arquivoNome: file.name }
      } catch {}

      if (!r.sucesso) {
        setErro(r.erro || 'Não foi possível ler a ata. Preencha manualmente.')
        if (arquivo.arquivoUrl) { setPdfNome(file.name); setF(o => ({ ...o, ...arquivo })) }
      } else {
        const d = r.dados || {}
        setPdfNome(file.name)
        setF(o => ({
          ...o,
          ...arquivo,
          numeroAta: d.numeroAta || o.numeroAta,
          orgao: d.orgao || o.orgao,
          cnpjOrgao: d.cnpjOrgao || o.cnpjOrgao,
          uf: d.uf || o.uf,
          licitacao: d.licitacao || o.licitacao,
          processo: d.processo || o.processo,
          objeto: d.objeto || o.objeto,
          representante: d.representante || o.representante,
          dataAssinatura: brParaISO(d.dataAssinatura) || o.dataAssinatura,
          vigencia: d.vigencia || o.vigencia,
          vencimento: brParaISO(d.vencimento) || o.vencimento,
          adesao: d.adesao || o.adesao,
          condPagamento: d.condPagamento || o.condPagamento,
          contato: d.contato || o.contato,
          emailOrgao: d.emailOrgao || extrairEmail(d.contato) || o.emailOrgao,
          telefoneOrgao: d.telefoneOrgao || extrairTelefone(d.contato) || o.telefoneOrgao,
          observacoes: d.observacoes || o.observacoes,
        }))
        if (Array.isArray(d.itens) && d.itens.length) setItens(d.itens)
      }
    } catch (ex) {
      setErro(ex.message || 'Erro ao enviar o PDF.')
    }
    setLendoPdf(false)
  }
  const setItem = (i, k, v) => setItens(a => a.map((it, j) => j === i ? { ...it, [k]: v } : it))
  const total = itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), 0)

  async function salvar() {
    if (!f.numeroAta.trim()) { setErro('Nº da ata é obrigatório.'); return }
    setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/atas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ata.id || null, empresa_id: empresaId,
          ...f,
          dataAssinatura: isoParaBR(f.dataAssinatura),
          vencimento: isoParaBR(f.vencimento),
          itensJson: JSON.stringify(itens.filter(it => String(it.descricao || '').trim())),
        }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo()
      else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal modal-lg">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">ATA DE REGISTRO DE PREÇOS</div>
            <div className="modal-hdr-title">{ed ? 'Editar ata ' + ata.numeroAta : 'Incluir ata'}</div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">
          <label className={'uz' + (lendoPdf ? ' uploading' : pdfNome ? ' success' : '')}>
            <input type="file" accept=".pdf" onChange={onPdf} disabled={lendoPdf} style={{ display: 'none' }} />
            {lendoPdf
              ? <div>🤖 Gemini lendo a ata completa... (pode levar até 60s)</div>
              : pdfNome
                ? <div>✅ {pdfNome}<div style={{ fontSize: 12, marginTop: 4 }}>dados preenchidos — confira antes de salvar</div></div>
                : <div>🤖 Preenchimento automático — envie o PDF da ata<div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>o Gemini extrai todos os campos e itens · até 25 MB</div></div>}
          </label>

          <div className="form-sub">
            <label className="mini-lbl">VINCULAR A UM PREGÃO VENCIDO (OPCIONAL)</label>
            <select value={f.licitacaoId} onChange={e => vincularLicitacao(e.target.value)} disabled={!ganhas}>
              <option value="">{ganhas === null ? 'Carregando...' : ganhas.length === 0 ? 'Nenhum pregão finalizado como vencedor nesta empresa' : 'Selecione...'}</option>
              {ganhas?.map(l => (
                <option key={l.id} value={l.id}>{l.numeroEdital || 'Sem nº'} — {l.orgao}{l.uf ? '/' + l.uf : ''}</option>
              ))}
            </select>
            <p className="dica-menus" style={{ marginTop: 4 }}>
              Preenche órgão, UF, objeto e licitação de origem a partir do pregão escolhido — ajuste o que precisar depois.
            </p>
          </div>

          <div className="form-grid">
            <div><label className="mini-lbl">Nº DA ATA *</label><input value={f.numeroAta} onChange={e => set('numeroAta', e.target.value)} placeholder="17/2026" /></div>
            <div><label className="mini-lbl">UF</label>
              <select value={f.uf} onChange={e => set('uf', e.target.value)}>
                <option value="">Selecione</option>
                {UFS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="mini-lbl">ÓRGÃO / ENTIDADE</label><input value={f.orgao} onChange={e => set('orgao', e.target.value)} /></div>
            <div><label className="mini-lbl">CNPJ DO ÓRGÃO</label><input value={f.cnpjOrgao} onChange={e => set('cnpjOrgao', e.target.value)} /></div>
            <div><label className="mini-lbl">LICITAÇÃO DE ORIGEM</label><input value={f.licitacao} onChange={e => set('licitacao', e.target.value)} placeholder="Pregão Eletrônico SRP nº..." /></div>
            <div><label className="mini-lbl">PROCESSO</label><input value={f.processo} onChange={e => set('processo', e.target.value)} /></div>
            <div><label className="mini-lbl">REPRESENTANTE LEGAL</label><input value={f.representante} onChange={e => set('representante', e.target.value)} /></div>
            <div><label className="mini-lbl">DATA DE ASSINATURA</label><input type="date" value={f.dataAssinatura} onChange={e => set('dataAssinatura', e.target.value)} /></div>
            <div><label className="mini-lbl">VIGÊNCIA (texto)</label><input value={f.vigencia} onChange={e => set('vigencia', e.target.value)} placeholder="12 meses da assinatura" /></div>
            <div><label className="mini-lbl">VENCIMENTO</label><input type="date" value={f.vencimento} onChange={e => set('vencimento', e.target.value)} /></div>
            <div><label className="mini-lbl">CONDIÇÃO DE PAGAMENTO</label><input value={f.condPagamento} onChange={e => set('condPagamento', e.target.value)} /></div>
            <div><label className="mini-lbl">E-MAIL DO ÓRGÃO</label>
              <input type="email" value={f.emailOrgao} onChange={e => set('emailOrgao', e.target.value)}
                placeholder="licitacao@orgao.gov.br" /></div>
            <div><label className="mini-lbl">TELEFONE DO ÓRGÃO</label>
              <input value={f.telefoneOrgao} onChange={e => set('telefoneOrgao', e.target.value)}
                placeholder="(00) 0000-0000" /></div>
          </div>

          <div className="form-sub"><label>ADESÃO (CARONA)</label><input value={f.adesao} onChange={e => set('adesao', e.target.value)} placeholder="Permitida — 50% por órgão, ou NÃO ADMITIDA" /></div>
          <div className="form-sub"><label>OBJETO</label><textarea rows={2} value={f.objeto} onChange={e => set('objeto', e.target.value)} /></div>
          <div className="form-sub"><label>OBSERVAÇÕES</label><textarea rows={2} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Reajuste, foro, cláusulas relevantes..." /></div>

          <div className="form-sub">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ margin: 0 }}>ITENS REGISTRADOS</label>
              <button className="iBtn" onClick={() => setItens(a => [...a, { item: '', descricao: '', marca: '', unidade: 'UN', quantidade: '', valorUnitario: '', qtdEmpenhada: '' }])}>+ Item</button>
            </div>
            {itens.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8', padding: 8, textAlign: 'center', background: '#F8FAFC', borderRadius: 8 }}>Nenhum item.</div>}
            {itens.map((it, i) => (
              <div className="item-row" key={i}>
                <input placeholder="Nº" value={it.item || ''} onChange={e => setItem(i, 'item', e.target.value)} />
                <input placeholder="Descrição" value={it.descricao || ''} onChange={e => setItem(i, 'descricao', e.target.value)} />
                <input placeholder="Marca" value={it.marca || ''} onChange={e => setItem(i, 'marca', e.target.value)} />
                <input placeholder="UN" value={it.unidade || ''} onChange={e => setItem(i, 'unidade', e.target.value)} />
                <input placeholder="Qtd" type="number" value={it.quantidade || ''} onChange={e => setItem(i, 'quantidade', e.target.value)} />
                <input placeholder="Vl. unit." type="number" step="0.01" value={it.valorUnitario || ''} onChange={e => setItem(i, 'valorUnitario', e.target.value)} />
                <input placeholder="Emp." type="number" value={it.qtdEmpenhada || ''} onChange={e => setItem(i, 'qtdEmpenhada', e.target.value)} style={{ background: '#FFFBEB' }} />
                <button className="iBtn iBtn-del" onClick={() => setItens(a => a.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {itens.length > 0 && <div style={{ textAlign: 'right', fontWeight: 700, color: '#145653', marginTop: 8, fontSize: 12 }}>Valor total registrado: {fmtMoeda(total)}</div>}
          </div>

          {erro && <div className="l-err" style={{ marginTop: 12 }}>{erro}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar ata'}
          </button>
        </div>
      </div>
    </div>
  )
}
