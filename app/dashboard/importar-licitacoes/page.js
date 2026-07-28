'use client'
import { useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { FASES } from '@/lib/fases'
import { STATUS_LIC } from '@/lib/statusLicitacao'
import { RESULTADOS } from '@/lib/resultado'

export default function ImportarLicitacoesPage() {
  const { usuario, empresas } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()

  const [empresaId, setEmpresaId] = useState('')
  const [palavraEmpresa, setPalavraEmpresa] = useState('')
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [arquivoNome, setArquivoNome] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [registros, setRegistros] = useState(null)
  const [empresaNomeResultado, setEmpresaNomeResultado] = useState('')
  const [importando, setImportando] = useState(false)
  const [resultadoFinal, setResultadoFinal] = useState(null)

  if (perfil !== 'adm') {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Você não tem permissão para acessar esta página.</div>
  }

  function empresaEscolhida(id) {
    setEmpresaId(id)
    const e = empresas.find(x => String(x.id) === id)
    if (e && !palavraEmpresa) setPalavraEmpresa(e.nome.split(' ')[0].toUpperCase())
  }

  async function processarArquivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!empresaId) { setErro('Selecione a empresa antes de enviar o arquivo.'); return }
    setErro(''); setCarregando(true); setRegistros(null); setResultadoFinal(null)
    setArquivoNome(file.name)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result).split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const r = await fetch('/api/licitacoes/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, empresaId, mes, ano, palavraEmpresa }),
      }).then(x => x.json())
      if (r.sucesso) {
        setRegistros(r.registros.map((reg, i) => ({ ...reg, _id: i, _incluir: !reg._jaExiste })))
        setEmpresaNomeResultado(r.empresaNome)
      } else setErro(r.erro || 'Erro ao processar a planilha.')
    } catch {
      setErro('Erro ao ler o arquivo.')
    }
    setCarregando(false)
  }

  function atualizar(id, campo, valor) {
    setRegistros(rs => rs.map(r => r._id === id ? { ...r, [campo]: valor } : r))
  }

  async function confirmar() {
    const selecionados = registros.filter(r => r._incluir)
    if (!selecionados.length) { setErro('Marque ao menos uma licitação para importar.'); return }
    setImportando(true); setErro('')
    try {
      const r = await fetch('/api/licitacoes/importar/confirmar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, registros: selecionados }),
      }).then(x => x.json())
      if (r.sucesso) setResultadoFinal(r)
      else setErro(r.erro || 'Erro ao importar.')
    } catch {
      setErro('Erro de conexão.')
    }
    setImportando(false)
  }

  const selecionadas = registros ? registros.filter(r => r._incluir).length : 0

  return (
    <div>
      <h2 className="sec-title">Importar licitações (planilha do Licitei)</h2>
      <p className="sec-sub">Traz várias licitações de uma vez a partir da exportação "Minhas Licitações" — você revisa antes de gravar.</p>

      <div className="form-card">
        <div className="form-grid">
          <div>
            <label className="mini-lbl">EMPRESA</label>
            <select value={empresaId} onChange={e => empresaEscolhida(e.target.value)}>
              <option value="">Selecione...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mini-lbl">PALAVRA NAS TAGS QUE IDENTIFICA A EMPRESA</label>
            <input value={palavraEmpresa} onChange={e => setPalavraEmpresa(e.target.value)} placeholder="Ex: MONTANA" />
          </div>
          <div>
            <label className="mini-lbl">MÊS</label>
            <select value={mes} onChange={e => setMes(e.target.value)}>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mini-lbl">ANO</label>
            <input value={ano} onChange={e => setAno(e.target.value)} style={{ width: 90 }} />
          </div>
        </div>

        <div className="form-sub">
          <label>ARQUIVO (.xlsx exportado do Licitei, aba "Dados")</label>
          <label className={'uz' + (carregando ? ' uploading' : arquivoNome ? ' success' : '')} style={{ padding: 16 }}>
            <input type="file" accept=".xlsx" onChange={processarArquivo} disabled={carregando} style={{ display: 'none' }} />
            {carregando ? 'Lendo a planilha...' : arquivoNome ? '✅ ' + arquivoNome + ' · clique para trocar' : '📄 Clique para enviar o arquivo .xlsx'}
          </label>
        </div>

        {erro && <div className="l-err">{erro}</div>}
      </div>

      {registros && !resultadoFinal && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: '#475569' }}>
              <strong>{registros.length}</strong> encontrada{registros.length !== 1 ? 's' : ''} para <strong>{empresaNomeResultado}</strong> em {mes}/{ano}
              {' '}— <strong>{selecionadas}</strong> selecionada{selecionadas !== 1 ? 's' : ''}
            </div>
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={confirmar} disabled={importando || !selecionadas}>
              {importando ? 'Importando...' : `Confirmar importação (${selecionadas})`}
            </button>
          </div>

          {registros.length === 0 && (
            <div className="aviso-box">Nenhuma linha bateu com o mês/ano e a palavra-chave informados. Confira os filtros.</div>
          )}

          {registros.map(r => (
            <div key={r._id} className={'import-card' + (r._aviso ? ' import-aviso' : '')}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <input type="checkbox" checked={r._incluir} onChange={e => atualizar(r._id, '_incluir', e.target.checked)}
                  style={{ marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1B2E4B', fontSize: 13.5 }}>
                    {r.numeroEdital} {r._jaExiste && <span className="pill pill-gray" style={{ marginLeft: 6 }}>já existe na base</span>}
                    {r._foraDoMes && <span className="pill pill-blue" style={{ marginLeft: 6 }}>ainda em andamento · fora do mês filtrado</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{r.orgao} / {r.uf} · {r.portal} · {r.dataAbertura} · {r.valor || 'valor não informado'}</div>
                  {r._aviso && <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 4 }}>⚠️ {r._aviso}</div>}
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    tags originais: {r._tagsOriginais || '—'}{r._observacoesOriginais ? ' · obs: ' + r._observacoesOriginais : ''}
                  </div>

                  <div className="import-campos">
                    <select value={r.fase} onChange={e => atualizar(r._id, 'fase', e.target.value)}>
                      {FASES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                    <select value={r.status} onChange={e => atualizar(r._id, 'status', e.target.value)}>
                      {STATUS_LIC.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                    <select value={r.resultado} onChange={e => atualizar(r._id, 'resultado', e.target.value)}>
                      {RESULTADOS.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                    <select value={r.participar} onChange={e => atualizar(r._id, 'participar', e.target.value)}>
                      <option value="Sim">Participar: Sim</option>
                      <option value="Não">Participar: Não</option>
                      <option value="Pendente">Participar: Pendente</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resultadoFinal && (
        <div className="form-card" style={{ marginTop: 20 }}>
          <div className="l-ok">
            {resultadoFinal.inseridos} de {resultadoFinal.total} licitações importadas com sucesso para {empresaNomeResultado}.
          </div>
          {resultadoFinal.erros?.length > 0 && (
            <div className="l-err" style={{ marginTop: 10 }}>
              {resultadoFinal.erros.length} com erro: {resultadoFinal.erros.map(e => e.registro).join(', ')}
            </div>
          )}
          <a href="/dashboard/licitacoes" className="btn-ghost" style={{ marginTop: 10, display: 'inline-block' }}>Ver em Licitações</a>
        </div>
      )}
    </div>
  )
}
