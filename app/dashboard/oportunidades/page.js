'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { MODALIDADES, UFS } from '@/lib/pncpComum'
import { buscarNoNavegador, verificarCatalogo } from '@/lib/pncpBrowser'
import { aplicarPerfil, listaDe, vazio } from '@/lib/perfilBusca'
import { MOTIVOS_NAO_PARTICIPACAO } from '@/lib/resultado'

const diasAte = dataBR => {
  const m = String(dataBR || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T23:59:00`)
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return Math.ceil((d - h) / 86400000)
}

const destacar = (texto, termos) => {
  if (!termos.length) return texto
  const re = new RegExp('(' + termos.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi')
  return String(texto).split(re).map((p, i) =>
    termos.some(t => t.toLowerCase() === p.toLowerCase())
      ? <mark key={i}>{p}</mark> : p)
}

export default function OportunidadesPage() {
  const { usuario, empresaAtual, empresas } = useApp()
  const perfilUsuario = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfilUsuario === 'empresa'

  const [perfis, setPerfis] = useState({})
  const [f, setF] = useState({ ...vazio, dias: 3 })
  const [salvos, setSalvos] = useState({})
  const [res, setRes] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [etapa, setEtapa] = useState('')
  const [erro, setErro] = useState('')
  const [diag, setDiag] = useState([])
  const [ordem, setOrdem] = useState('relevancia')
  const [verificandoCat, setVerificandoCat] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(true)
  const [descartando, setDescartando] = useState(null)
  const [msgPerfil, setMsgPerfil] = useState('')

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresaNome = empresaSel ? (empresas.find(e => String(e.id) === empresaSel)?.nome || '') : null

  const carregarPerfis = useCallback(() => {
    fetch('/api/perfil-busca').then(r => r.json())
      .then(r => { if (r.sucesso) setPerfis(r.perfis) }).catch(() => {})
  }, [])
  useEffect(() => { carregarPerfis() }, [carregarPerfis])

  // Ao trocar de empresa, carrega o perfil salvo dela
  useEffect(() => {
    if (!empresaSel) return
    const p = perfis[empresaSel]
    setF(o => ({
      ...o,
      palavrasChave: p?.palavrasChave || '',
      palavrasExcluidas: p?.palavrasExcluidas || '',
      ufs: p?.ufs || o.ufs || 'RJ',
      modalidades: p?.modalidades || o.modalidades || '6,8',
      valorMinimo: p?.valorMinimo || '',
      valorMaximo: p?.valorMaximo || '',
      catmat: p?.catmat || '',
      catser: p?.catser || '',
    }))
  }, [empresaSel, perfis])

  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const ufsSel = listaDe(f.ufs)
  const modsSel = listaDe(f.modalidades).map(Number)
  const alternar = (campo, valor) => {
    const atual = listaDe(f[campo])
    const novo = atual.includes(String(valor)) ? atual.filter(x => x !== String(valor)) : [...atual, String(valor)]
    set(campo, novo.join(','))
  }

  async function buscar() {
    setErro(''); setDiag([]); setBuscando(true); setRes(null); setSalvos({})
    // Busca dirigida: informando a UASG (ou o CNPJ do órgão), o PNCP devolve as
    // contratações daquela unidade, sem varrer estado por estado. Serve para
    // achar licitação cuja disputa acontece em Licitar Digital, Portal de
    // Compras Públicas etc. — a publicação continua sendo no PNCP.
    const dirigida = !!(f.uasg?.trim() || f.cnpjOrgao?.trim() || f.orgaoNome?.trim() || f.portalNome?.trim())
    const consulta = {
      dias: f.dias, ufs: ufsSel, modalidades: modsSel, termo: '',
      uasg: f.uasg?.trim() || '', cnpjOrgao: f.cnpjOrgao?.trim() || '',
    }
    try {
      setEtapa(dirigida ? 'Consultando o PNCP pela unidade...' : 'Consultando o PNCP...')
      const r = await fetch('/api/oportunidades', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consulta),
      }).then(x => x.json())

      let brutos = null
      if (r.sucesso) brutos = r.oportunidades
      else if (r.limitado) {
        setEtapa('Servidor bloqueado pelo PNCP. Buscando pela sua conexão...')
        const b = await buscarNoNavegador(consulta)
        if (b.bloqueioCORS && !b.resultados.length) {
          setErro('O PNCP recusou a consulta pelo servidor e pelo navegador.')
          setDiag([...(r.diagnostico || []), ...(b.diagnostico || [])])
        } else brutos = b.resultados
      } else { setErro(r.erro || 'Erro na busca.'); setDiag(r.diagnostico || []) }

      // Órgão e portal não são filtros da API do PNCP — são aplicados sobre o
      // resultado, comparando sem acento e sem diferença de maiúscula.
      const semAcento = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const filtrarTexto = lista => {
        const alvoOrgao = semAcento(f.orgaoNome).trim()
        const alvoPortal = semAcento(f.portalNome).trim()
        if (!alvoOrgao && !alvoPortal) return lista
        return lista.filter(o =>
          (!alvoOrgao || semAcento(o.orgao).includes(alvoOrgao)) &&
          (!alvoPortal || semAcento(o.portal + ' ' + o.link).includes(alvoPortal)))
      }
      if (brutos) setRes(filtrarTexto(dirigida ? brutos : aplicarPerfil(brutos, f)))
    } catch (ex) { setErro('Erro de conexão: ' + (ex.message || '')) }
    setBuscando(false); setEtapa('')
  }

  async function verificarCat() {
    const codigos = [...listaDe(f.catmat), ...listaDe(f.catser)]
    if (!codigos.length || !res) return
    setVerificandoCat(true)
    try {
      const atualizados = await verificarCatalogo(res, codigos)
      setRes(atualizados)
    } catch { /* mantém a lista atual */ }
    setVerificandoCat(false)
  }

  async function salvarPerfil() {
    if (!empresaSel) return
    setMsgPerfil('')
    const r = await fetch('/api/perfil-busca', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: empresaSel, ...f }),
    }).then(x => x.json())
    setMsgPerfil(r.sucesso ? 'Perfil de busca salvo para ' + empresaNome : (r.erro || 'Erro ao salvar.'))
    if (r.sucesso) carregarPerfis()
    setTimeout(() => setMsgPerfil(''), 4000)
  }

  async function gravar(op, extras) {
    setSalvos(s => ({ ...s, [op.numeroPNCP]: 'salvando' }))
    const r = await fetch('/api/licitacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa_id: empresaSel,
        numeroPNCP: op.numeroPNCP, numeroEdital: op.numeroEdital, objeto: op.objeto,
        orgao: op.orgao, uasg: op.uasg, uf: op.uf, valor: op.valor,
        dataPublicacao: op.dataPublicacao, dataAbertura: op.dataAbertura, dataLimite: op.dataLimite,
        // Sem isso a licitação nascia sem data da sessão e aparecia com "—" na lista
        dataSessao: op.dataLimite || op.dataAbertura || '',
        modalidade: op.modalidade, portal: op.portal, srp: op.srp,
        status: op.status, link: op.link, origem: 'pncp', ...extras,
      }),
    }).then(x => x.json())
    setSalvos(s => ({ ...s, [op.numeroPNCP]: r.sucesso ? (extras?.resultado ? 'descartada' : 'ok') : (r.duplicada ? 'dup' : 'erro') }))
    if (!r.sucesso && !r.duplicada) alert(r.erro || 'Erro ao salvar.')
  }

  const termos = listaDe(f.palavrasChave)

  const lista = useMemo(() => {
    if (!res) return []
    const l = [...res]
    if (ordem === 'relevancia') l.sort((a, b) => (b.catalogoCasado?.length || 0) - (a.catalogoCasado?.length || 0) || b.relevancia.pontos - a.relevancia.pontos || b.valorNum - a.valorNum)
    if (ordem === 'prazo') l.sort((a, b) => (diasAte(a.dataLimite) ?? 999) - (diasAte(b.dataLimite) ?? 999))
    if (ordem === 'valor') l.sort((a, b) => b.valorNum - a.valorNum)
    return l
  }, [res, ordem])

  const totalValor = lista.reduce((s, o) => s + (o.valorNum || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Oportunidades</h2>
          <p className="sec-sub">
            Busca no PNCP · {empresaNome ? 'perfil de ' + empresaNome : 'selecione uma empresa para usar o perfil salvo'}
          </p>
        </div>
        <button className="filtro-btn" onClick={() => setFiltrosAbertos(a => !a)}>
          {filtrosAbertos ? '▲ Ocultar filtros' : '▼ Mostrar filtros'}
        </button>
      </div>

      {filtrosAbertos && (
        <div className="form-card">
          <div className="filtro-linha">
            <div style={{ minWidth: 150 }}>
              <label className="mini-lbl">PERÍODO</label>
              <select value={f.dias} onChange={e => set('dias', Number(e.target.value))}>
                {[1, 3, 7, 15, 30].map(d => <option key={d} value={d}>Últimos {d} dia{d > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="mini-lbl">PALAVRAS-CHAVE (vírgula)</label>
              <input value={f.palavrasChave} onChange={e => set('palavrasChave', e.target.value)}
                placeholder="barra de apoio, piso tátil, corrimão" />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="mini-lbl">EXCLUIR SE CONTIVER</label>
              <input value={f.palavrasExcluidas} onChange={e => set('palavrasExcluidas', e.target.value)}
                placeholder="locação, manutenção, mão de obra" />
            </div>
          </div>

          <div className="filtro-linha" style={{ marginTop: 10 }}>
            <div style={{ minWidth: 140 }}>
              <label className="mini-lbl">VALOR MÍNIMO (R$)</label>
              <input type="number" value={f.valorMinimo} onChange={e => set('valorMinimo', e.target.value)} placeholder="0" />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="mini-lbl">VALOR MÁXIMO (R$)</label>
              <input type="number" value={f.valorMaximo} onChange={e => set('valorMaximo', e.target.value)} placeholder="sem limite" />
            </div>
            <div style={{ minWidth: 160 }}>
              <label className="mini-lbl">CATMAT (materiais)</label>
              <input value={f.catmat} onChange={e => set('catmat', e.target.value)} placeholder="150123, 267890" />
            </div>
            <div style={{ minWidth: 160 }}>
              <label className="mini-lbl">CATSER (serviços)</label>
              <input value={f.catser} onChange={e => set('catser', e.target.value)} placeholder="17278" />
            </div>
          </div>

          {/* Busca dirigida — para achar um edital específico de qualquer portal */}
          <div className="filtro-linha" style={{ marginTop: 10 }}>
            <div style={{ minWidth: 160 }}>
              <label className="mini-lbl">UASG / UNIDADE</label>
              <input value={f.uasg} onChange={e => set('uasg', e.target.value)} placeholder="Ex: 925998" />
            </div>
            <div style={{ minWidth: 190 }}>
              <label className="mini-lbl">CNPJ DO ÓRGÃO</label>
              <input value={f.cnpjOrgao} onChange={e => set('cnpjOrgao', e.target.value)} placeholder="Só números" />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="mini-lbl">ÓRGÃO (nome contém)</label>
              <input value={f.orgaoNome} onChange={e => set('orgaoNome', e.target.value)}
                placeholder="Ex: marinha, prefeitura de niterói" />
            </div>
            <div style={{ minWidth: 170 }}>
              <label className="mini-lbl">PORTAL DA DISPUTA</label>
              <input value={f.portalNome} onChange={e => set('portalNome', e.target.value)}
                placeholder="Ex: licitar, compraspublicas, bll" />
            </div>
          </div>
          <p className="dica-menus" style={{ marginTop: 6 }}>
            UASG e CNPJ vão direto na unidade dentro do PNCP, em qualquer estado e sem filtrar por
            palavra-chave — é assim que se acha um edital cuja disputa acontece no Licitar Digital ou
            no Portal de Compras Públicas. Órgão e portal são peneirados depois, sobre o que voltou,
            então continuam dependendo do estado e do período escolhidos abaixo.
          </p>

          <div className="form-sub">
            <label>MODALIDADES</label>
            <div className="chip-group">
              {MODALIDADES.map(m => (
                <button key={m.cod} className={'chip-opt' + (modsSel.includes(m.cod) ? ' on' : '')}
                  onClick={() => alternar('modalidades', m.cod)}>{m.nome}</button>
              ))}
            </div>
          </div>

          <div className="form-sub">
            <label>ESTADOS ({ufsSel.length})</label>
            <div className="chip-group">
              <button className="chip-opt chip-uf" onClick={() => set('ufs', ufsSel.length === UFS.length ? 'RJ' : UFS.join(','))}>
                {ufsSel.length === UFS.length ? 'limpar' : 'todos'}
              </button>
              {UFS.map(u => (
                <button key={u} className={'chip-opt chip-uf' + (ufsSel.includes(u) ? ' on' : '')}
                  onClick={() => alternar('ufs', u)}>{u}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={buscar}
              disabled={buscando || !modsSel.length || (!ufsSel.length && !f.uasg?.trim() && !f.cnpjOrgao?.trim())}>
              {buscando ? 'Consultando...' : '🔎 Buscar'}
            </button>
            {empresaSel && !somenteConsulta && (
              <button className="iBtn" onClick={salvarPerfil}>💾 Salvar como perfil de {empresaNome}</button>
            )}
            {msgPerfil && <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>{msgPerfil}</span>}
          </div>
          {buscando && etapa && <div style={{ marginTop: 10, fontSize: 12.5, color: '#1E40AF' }}>{etapa}</div>}
        </div>
      )}

      {erro && (
        <div className="l-err" style={{ marginTop: 14 }}>
          <strong>{erro}</strong>
          {diag.length > 0 && <ul style={{ margin: '8px 0 0 16px', fontSize: 11.5 }}>{diag.map((d, i) => <li key={i}>{d}</li>)}</ul>}
        </div>
      )}

      {res && (
        <>
          <div className="barra-res">
            <div>
              <strong>{lista.length}</strong> oportunidade{lista.length !== 1 ? 's' : ''}
              {totalValor > 0 && <> · R$ {totalValor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} em jogo</>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {(listaDe(f.catmat).length > 0 || listaDe(f.catser).length > 0) && (
                <button className="iBtn" onClick={verificarCat} disabled={verificandoCat}>
                  {verificandoCat ? 'Verificando itens...' : '🔍 Conferir CATMAT/CATSER'}
                </button>
              )}
              <select className="ordem-sel" value={ordem} onChange={e => setOrdem(e.target.value)}>
                <option value="relevancia">Mais relevantes</option>
                <option value="prazo">Prazo mais próximo</option>
                <option value="valor">Maior valor</option>
              </select>
            </div>
          </div>

          {lista.length === 0 && (
            <div className="aviso-box">
              Nenhuma oportunidade com esses filtros. Tente ampliar o período, reduzir palavras-chave ou incluir mais estados.
            </div>
          )}

          {lista.map(op => {
            const st = salvos[op.numeroPNCP]
            const dd = diasAte(op.dataLimite)
            const urgente = dd !== null && dd <= 3
            return (
              <div className={'op-card' + (urgente ? ' urgente' : '')} key={op.numeroPNCP}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="op-tags">
                    <span className="tag-mod">{op.modalidade}</span>
                    {op.srp === 'Sim' && <span className="tag-srp">SRP</span>}
                    {op.catalogoCasado?.length > 0 && <span className="tag-cat">CATMAT/CATSER {op.catalogoCasado.join(', ')}</span>}
                    {op.relevancia?.casadas?.map(c => <span className="tag-kw" key={c}>{c}</span>)}
                  </div>
                  <div className="op-obj">{destacar(op.objeto, termos)}</div>
                  <div className="op-meta">
                    {op.orgao}{op.uasg ? ' · UASG ' + op.uasg : ''}{op.municipio ? ' · ' + op.municipio : ''}/{op.uf}
                    {op.portal ? ' · ' + op.portal : ''}
                  </div>
                  <div className="op-linha">
                    {op.valor && <span className="op-valor">{op.valor}</span>}
                    {dd !== null && (
                      <span className={'op-prazo' + (urgente ? ' urg' : '')}>
                        {dd < 0 ? 'encerrada' : dd === 0 ? 'encerra hoje' : `${dd} dia${dd > 1 ? 's' : ''} para a proposta`}
                      </span>
                    )}
                    {op.dataLimite && <span style={{ color: '#94A3B8' }}>até {op.dataLimite}</span>}
                  </div>
                </div>

                <div className="op-acoes">
                  {op.link && <a href={op.link} target="_blank" rel="noreferrer" className="iBtn">↗ Edital</a>}
                  {!somenteConsulta && (
                    st === 'ok' ? <span className="pill pill-green">✓ salva</span>
                    : st === 'descartada' ? <span className="pill pill-gray">✓ descartada</span>
                    : st === 'dup' ? <span className="pill pill-gray">já registrada</span>
                    : <>
                        <button className="iBtn iBtn-up" disabled={st === 'salvando' || !empresaSel} onClick={() => gravar(op)}>
                          {st === 'salvando' ? '...' : '+ Licitações'}
                        </button>
                        <button className="iBtn" disabled={!empresaSel} onClick={() => setDescartando(op)}>Descartar</button>
                      </>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}

      {descartando && (
        <ModalDescarte
          op={descartando}
          onFechar={() => setDescartando(null)}
          onConfirmar={async motivo => {
            await gravar(descartando, { resultado: 'Nao participamos', motivo, participar: 'Não', status: 'Encerrada' })
            setDescartando(null)
          }}
        />
      )}
    </div>
  )
}

function ModalDescarte({ op, onFechar, onConfirmar }) {
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal modal-sm">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">DESCARTAR OPORTUNIDADE</div>
            <div className="modal-hdr-title">Por que não vamos disputar?</div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12 }}>
            {String(op.objeto).slice(0, 140)}
          </p>
          <div className="form-sub">
            <label>MOTIVO</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}>
              <option value="">Selecione</option>
              {MOTIVOS_NAO_PARTICIPACAO.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="aviso-box" style={{ marginTop: 12 }}>
            A oportunidade fica registrada como analisada e não disputada — e entra automaticamente no relatório mensal do cliente.
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} disabled={!motivo || salvando}
            onClick={async () => { setSalvando(true); await onConfirmar(motivo) }}>
            {salvando ? 'Registrando...' : 'Registrar descarte'}
          </button>
        </div>
      </div>
    </div>
  )
}
