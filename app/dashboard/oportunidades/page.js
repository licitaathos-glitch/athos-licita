'use client'
import { useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { MODALIDADES, UFS } from '@/lib/pncpConstantes'

export default function OportunidadesPage() {
  const { usuario, empresaAtual, empresas } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfil === 'empresa'

  const [dias, setDias] = useState(3)
  const [ufs, setUfs] = useState(['RJ'])
  const [mods, setMods] = useState([6, 8])
  const [termo, setTermo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [res, setRes] = useState(null)
  const [erro, setErro] = useState('')
  const [diag, setDiag] = useState([])
  const [salvos, setSalvos] = useState({})

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresaNome = empresaSel ? (empresas.find(e => String(e.id) === empresaSel)?.nome || '') : null

  const alternar = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  async function buscar() {
    setErro(''); setDiag([]); setBuscando(true); setRes(null); setSalvos({})
    try {
      const r = await fetch('/api/oportunidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias, ufs, modalidades: mods, termo }),
      }).then(x => x.json())
      if (r.sucesso) { setRes(r.oportunidades); setDiag(r.diagnostico || []) }
      else { setErro(r.erro || 'Erro na busca.'); setDiag(r.diagnostico || []) }
    } catch {
      setErro('Erro de conexão.')
    }
    setBuscando(false)
  }

  async function salvar(op) {
    if (!empresaSel) { alert('Selecione uma empresa no menu lateral antes de salvar.'); return }
    setSalvos(s => ({ ...s, [op.numeroPNCP]: 'salvando' }))
    try {
      const r = await fetch('/api/licitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaSel,
          numeroPNCP: op.numeroPNCP, numeroEdital: op.numeroEdital, objeto: op.objeto,
          orgao: op.orgao, uf: op.uf, valor: op.valor,
          dataPublicacao: op.dataPublicacao, dataAbertura: op.dataAbertura, dataLimite: op.dataLimite,
          modalidade: op.modalidade, portal: op.portal, srp: op.srp,
          status: op.status, link: op.link, origem: 'pncp',
        }),
      }).then(x => x.json())
      setSalvos(s => ({ ...s, [op.numeroPNCP]: r.sucesso ? 'ok' : (r.duplicada ? 'dup' : 'erro') }))
      if (!r.sucesso && !r.duplicada) alert(r.erro || 'Erro ao salvar.')
    } catch {
      setSalvos(s => ({ ...s, [op.numeroPNCP]: 'erro' }))
    }
  }

  return (
    <div>
      <h2 className="sec-title">Oportunidades</h2>
      <p className="sec-sub">
        Busca direta no PNCP · {empresaNome ? 'salvando em ' + empresaNome : 'selecione uma empresa para salvar'}
      </p>

      <div className="form-card">
        <div className="filtro-linha">
          <div>
            <label className="mini-lbl">PERÍODO</label>
            <select value={dias} onChange={e => setDias(Number(e.target.value))}>
              <option value={1}>Último dia</option>
              <option value={3}>Últimos 3 dias</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={15}>Últimos 15 dias</option>
              <option value={30}>Últimos 30 dias</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="mini-lbl">PALAVRAS-CHAVE (separadas por vírgula)</label>
            <input value={termo} onChange={e => setTermo(e.target.value)} placeholder="barra de apoio, piso tátil, hidráulica" />
          </div>
        </div>

        <div className="form-sub">
          <label>MODALIDADES</label>
          <div className="chip-group">
            {MODALIDADES.map(m => (
              <button key={m.cod} className={'chip-opt' + (mods.includes(m.cod) ? ' on' : '')}
                onClick={() => alternar(mods, setMods, m.cod)}>{m.nome}</button>
            ))}
          </div>
        </div>

        <div className="form-sub">
          <label>ESTADOS ({ufs.length} selecionado{ufs.length !== 1 ? 's' : ''})</label>
          <div className="chip-group">
            {UFS.map(u => (
              <button key={u} className={'chip-opt chip-uf' + (ufs.includes(u) ? ' on' : '')}
                onClick={() => alternar(ufs, setUfs, u)}>{u}</button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={buscar} disabled={buscando || !ufs.length || !mods.length}>
          {buscando ? 'Consultando o PNCP...' : '🔎 Buscar oportunidades'}
        </button>
      </div>

      {erro && (
        <div className="l-err" style={{ marginTop: 14 }}>
          <strong>{erro}</strong>
          {diag.length > 0 && (
            <ul style={{ margin: '8px 0 0 16px', fontSize: 11.5 }}>
              {diag.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>
      )}

      {res && (
        <>
          <div style={{ margin: '18px 0 12px', fontSize: 14, fontWeight: 700, color: '#1B2E4B' }}>
            {res.length} oportunidade{res.length !== 1 ? 's' : ''} encontrada{res.length !== 1 ? 's' : ''}
            {!empresaSel && <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 12 }}> · selecione uma empresa para salvar</span>}
          </div>

          {res.length === 0 && (
            <div className="aviso-box">Nenhuma oportunidade no período com esses filtros. Tente ampliar o período, remover palavras-chave ou incluir mais estados.</div>
          )}

          {res.map(op => {
            const st = salvos[op.numeroPNCP]
            return (
              <div className="op-card" key={op.numeroPNCP}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1B2E4B', fontSize: 13.5, marginBottom: 3 }}>{op.objeto}</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8' }}>
                    {op.orgao}{op.municipio ? ' · ' + op.municipio : ''}/{op.uf} · {op.modalidade}
                    {op.srp === 'Sim' ? ' · SRP' : ''}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4 }}>
                    {op.valor && <strong style={{ color: '#1B2E4B' }}>{op.valor}</strong>}
                    {op.dataLimite && <> · propostas até <strong>{op.dataLimite}</strong></>}
                    {op.portal && <> · {op.portal}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <span className={'pill ' + (op.status === 'Aberta' ? 'pill-green' : 'pill-gray')}>{op.status}</span>
                  {op.link && <a href={op.link} target="_blank" rel="noreferrer" className="iBtn">↗</a>}
                  {!somenteConsulta && (
                    st === 'ok' ? <span className="pill pill-green">✓ salva</span>
                    : st === 'dup' ? <span className="pill pill-gray">já salva</span>
                    : <button className="iBtn iBtn-up" disabled={st === 'salvando' || !empresaSel} onClick={() => salvar(op)}>
                        {st === 'salvando' ? '...' : '+ Licitações'}
                      </button>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
