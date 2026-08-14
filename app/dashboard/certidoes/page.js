'use client'
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { CATEGORIAS } from '@/lib/tiposCertidao'
import { enviarAoGAS, lerBase64 } from '@/lib/gasClient'
import VisualizadorArquivo from '@/components/VisualizadorArquivo'

const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#CBD5E1' }

function rotuloPrazo(c) {
  if (!c || c.dias === null || c.dias === undefined) return ''
  if (c.dias < 0) return 'Vencida há ' + Math.abs(c.dias) + 'd'
  if (c.dias === 0) return 'Vence hoje'
  return c.dias + 'd restantes'
}

export default function CertidoesPage() {
  const { usuario, empresaAtual, empresas } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfil === 'empresa'

  const [certidoes, setCertidoes] = useState(null)
  const [erro, setErro] = useState('')
  const [catAtiva, setCatAtiva] = useState('fiscal')
  const [modal, setModal] = useState(null)
  const [baixandoZip, setBaixandoZip] = useState(false)
  const [erroZip, setErroZip] = useState('')
  const [verArquivo, setVerArquivo] = useState(null)

  const carregar = useCallback(() => {
    fetch('/api/certidoes')
      .then(r => r.json())
      .then(r => { r.sucesso ? setCertidoes(r.certidoes) : setErro(r.erro || 'Erro ao carregar.') })
      .catch(() => setErro('Erro de conexão.'))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!certidoes) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresaNome = empresaSel ? (empresas.find(e => String(e.id) === empresaSel)?.nome || '') : 'Todas as empresas'
  const daEmpresa = empresaSel ? certidoes.filter(c => c.empresa_id === empresaSel) : certidoes

  const vencidas = daEmpresa.filter(c => c.status === 'bad').length
  const alerta = daEmpresa.filter(c => c.status === 'warn').length
  const cat = CATEGORIAS.find(c => c.slug === catAtiva)

  function docDoTipo(slug) {
    return daEmpresa.find(c => c.tipo_slug === slug)
  }

  async function baixarTodos() {
    if (!empresaSel) return
    setBaixandoZip(true); setErroZip('')
    try {
      const r = await fetch('/api/certidoes/zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: empresaSel }),
      }).then(x => x.json())
      if (!r.sucesso) { setErroZip(r.erro || 'Não foi possível gerar o zip.'); setBaixandoZip(false); return }
      const bytes = atob(r.base64)
      const buffer = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i)
      const blob = new Blob([buffer], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = r.nomeArquivo || `Documentos_${empresaNome}.zip`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setErroZip('Erro de conexão ao gerar o zip.')
    }
    setBaixandoZip(false)
  }

  return (
    <div>
      <h2 className="sec-title">Certidões e Documentos</h2>
      <p className="sec-sub">{empresaNome}{somenteConsulta ? ' · modo consulta' : ''}</p>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-val kv-navy">{daEmpresa.length}</div><div className="kpi-label">Documentos</div></div>
        <div className="kpi"><div className="kpi-val kv-red">{vencidas}</div><div className="kpi-label">Vencidas</div></div>
        <div className="kpi"><div className="kpi-val kv-amber">{alerta}</div><div className="kpi-label">Vencem em 7 dias</div></div>
      </div>

      {empresaSel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button className="iBtn iBtn-up" onClick={baixarTodos} disabled={baixandoZip || daEmpresa.length === 0}>
            {baixandoZip ? 'Gerando zip...' : '⬇ Baixar todos os documentos (.zip)'}
          </button>
          {erroZip && <span style={{ fontSize: 12, color: '#DC2626' }}>{erroZip}</span>}
        </div>
      )}

      {!empresaSel && (
        <div className="aviso-box">
          Selecione uma empresa no menu lateral para enviar ou atualizar documentos.
        </div>
      )}

      <div className="filtro-bar">
        {CATEGORIAS.map(c => {
          const venc = daEmpresa.filter(d => c.tipos.some(t => t.slug === d.tipo_slug) && d.status === 'bad').length
          return (
            <button key={c.slug} className={'filtro-btn' + (catAtiva === c.slug ? ' active' : '')} onClick={() => setCatAtiva(c.slug)}>
              {c.nome}{venc > 0 && <span className="filtro-badge">{venc}</span>}
            </button>
          )
        })}
      </div>

      <div className="cat-bloco">
        <div className="cat-hdr">
          {cat.nome}
          {!cat.temValidade && <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: 8, fontSize: 11 }}>sem validade</span>}
        </div>
        {cat.tipos.map(tipo => {
          const doc = docDoTipo(tipo.slug)
          const status = doc ? doc.status : 'nd'
          return (
            <div className="doc-row" key={tipo.slug}>
              <span className="doc-ind" style={{ background: CORES[status] }} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 600, color: '#145653', fontSize: 13 }}>{tipo.nome}</div>
                {doc?.observacao && <div className="doc-obs">{doc.observacao}</div>}
                {!empresaSel && doc && <div className="doc-obs">{doc.empresa_nome}</div>}
                {doc?.link ? (
                  <button className="drive-lnk" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    title="Ver, baixar ou imprimir a certidão"
                    onClick={ev => { ev.stopPropagation(); setVerArquivo({ url: doc.link, nome: tipo.nome }) }}>
                    📄 ver / baixar
                  </button>
                ) : doc && (
                  // Sem isso o documento simplesmente não mostrava nada e dava
                  // a impressão de que o arquivo existia e a tela é que falhava
                  <div style={{ fontSize: 11, color: '#B45309' }}>
                    sem arquivo guardado — use "Atualizar" e anexe o PDF
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {cat.temValidade ? (
                  doc?.validade
                    ? <>
                        <span style={{ fontSize: 12, color: '#64748B' }}>{doc.validade}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: CORES[status] }}>{rotuloPrazo(doc)}</span>
                      </>
                    : <span style={{ fontSize: 12, color: '#94A3B8' }}>Não informado</span>
                ) : (
                  <span style={{ fontSize: 12, color: doc ? '#166534' : '#94A3B8' }}>{doc ? 'Incluído' : 'Não incluído'}</span>
                )}
              </div>
              {!somenteConsulta && empresaSel && (
                <div className="doc-acts">
                  <button className="iBtn iBtn-up" onClick={() => setModal({ tipo, cat, doc, empresa_id: empresaSel, empresaNome })}>
                    ⬆ {doc ? 'Atualizar' : 'Enviar'}
                  </button>
                  {doc && (
                    <button className="iBtn iBtn-del" onClick={async () => {
                      if (!confirm('Excluir ' + tipo.nome + '?')) return
                      const r = await fetch('/api/certidoes', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: doc.id }),
                      }).then(x => x.json())
                      if (r.sucesso) carregar()
                      else alert(r.erro || 'Erro ao excluir.')
                    }}>🗑</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {verArquivo && (
        <VisualizadorArquivo url={verArquivo.url} nome={verArquivo.nome} onFechar={() => setVerArquivo(null)} />
      )}

      {modal && (
        <ModalUpload
          {...modal}
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregar() }}
        />
      )}
    </div>
  )
}

function ModalUpload({ tipo, cat, doc, empresa_id, empresaNome, onFechar, onSalvo }) {
  const [validade, setValidade] = useState(doc?.validade_iso || '')
  const [observacao, setObservacao] = useState(doc?.observacao || '')
  const [driveId, setDriveId] = useState(doc?.drive_file_id || '')
  const [driveUrl, setDriveUrl] = useState(doc?.link || '')
  const [arquivo, setArquivo] = useState(doc?.link ? 'arquivo já anexado' : '')
  const [extraido, setExtraido] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 25 * 1024 * 1024) {
      setErro('Arquivo muito grande (máx. 25 MB).')
      return
    }
    setErro(''); setEnviando(true); setExtraido(null)
    try {
      const base64 = await lerBase64(f)
      // Envio direto do navegador ao Apps Script — sem o limite de tamanho da Vercel
      const r = await enviarAoGAS({
        action: 'uploadCertidao',
        base64, mimeType: f.type || 'application/pdf', nomeArquivo: f.name,
        empresaId: empresa_id, nomeEmpresa: empresaNome, tipoSlug: tipo.slug,
      })

      setArquivo(f.name)
      if (r.driveFileId) setDriveId(r.driveFileId)
      if (r.driveFileUrl) setDriveUrl(r.driveFileUrl)

      if (r.ok && r.dados) {
        setExtraido(r.dados)
        if (cat.temValidade && r.dados.data_validade) setValidade(r.dados.data_validade)
        if (r.dados.numero) setObservacao(o => o || r.dados.numero)
      } else if (r.driveFileId) {
        setErro('Arquivo salvo no Drive, mas a leitura automática falhou: ' + (r.erro || 'sem detalhe') + ' — preencha manualmente.')
      } else {
        setErro(r.erro || 'Falha no envio.')
      }
    } catch (ex) {
      setErro(ex.message || 'Erro ao enviar o arquivo.')
    }
    setEnviando(false)
  }

  async function salvar() {
    setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/certidoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc?.id || null,
          empresa_id,
          tipo_slug: tipo.slug,
          validade: cat.temValidade ? validade : '',
          observacao,
          drive_file_id: driveId,
          drive_file_url: driveUrl,
        }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo()
      else setErro(r.erro || 'Erro ao salvar.')
    } catch {
      setErro('Erro de conexão.')
    }
    setSalvando(false)
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">DOCUMENTO</div>
            <div className="modal-hdr-title">{tipo.nome}</div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">
          <label className={'uz' + (enviando ? ' uploading' : arquivo ? ' success' : '')}>
            <input type="file" accept=".pdf,image/*" onChange={onFile} disabled={enviando} style={{ display: 'none' }} />
            {enviando
              ? <div>🤖 Enviando ao Drive e lendo com o Gemini... (pode levar até 40s)</div>
              : arquivo
                ? <div>✅ {arquivo}<div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>clique para trocar</div></div>
                : <div>📄 Clique para enviar o PDF ou imagem<div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>PDF ou imagem — até 25 MB</div></div>}
          </label>

          {extraido && (
            <div className="ia-box">
              <div className="ia-box-hdr">🤖 Dados lidos pelo Gemini</div>
              {[['Tipo', extraido.tipo_documento], ['Número', extraido.numero], ['Validade', extraido.data_validade],
                ['Órgão', extraido.orgao_emissor], ['Situação', extraido.situacao]]
                .filter(x => x[1]).map(x => (
                  <div className="ia-row" key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong></div>
                ))}
            </div>
          )}

          {cat.temValidade && (
            <div className="form-sub">
              <label>DATA DE VALIDADE</label>
              <input type="date" value={validade} onChange={e => setValidade(e.target.value)} />
            </div>
          )}
          <div className="form-sub">
            <label>OBSERVAÇÃO</label>
            <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Nº do protocolo, anotações..." />
          </div>

          {erro && <div className="l-err" style={{ marginTop: 12 }}>{erro}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando || enviando}>
            {salvando ? 'Salvando...' : 'Salvar documento'}
          </button>
        </div>
      </div>
    </div>
  )
}
