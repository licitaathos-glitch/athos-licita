'use client'
import { useState } from 'react'
import { FASES, normalizarFase } from '@/lib/fases'
import { nomeResultado, corResultado } from '@/lib/resultado'
import { STATUS_LIC, corStatus, nomeStatus } from '@/lib/statusLicitacao'

function diasAte(v) {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  const d = new Date(+m[3], +m[2] - 1, +m[1])
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return Math.ceil((d - h) / 86400000)
}

// Visão em abas por fase: os processos só aparecem depois de escolher a fase.
// A visão "Lista" (todas as fases juntas) usa o mesmo componente de linha,
// em grade fixa — colunas sempre alinhadas, sem quebra de margem.
export default function ListaLicitacoes({
  licitacoes, somenteConsulta, onMover, onChecklist, onStatus, onEditar, onExcluir,
  planas = false, // true = mostra tudo junto, sem abas (usada pela visão "Lista")
}) {
  const [faseAtiva, setFaseAtiva] = useState(FASES[0].id)
  const [aberta, setAberta] = useState(null)

  const porFase = {}
  FASES.forEach(f => { porFase[f.id] = [] })
  licitacoes.forEach(l => {
    const f = normalizarFase(l.fase || 'Em analise')
    if (porFase[f]) porFase[f].push(l)
  })

  const listaAtual = planas ? licitacoes : (porFase[faseAtiva] || [])

  return (
    <div>
      {!planas && (
        <div className="abas-fase">
          {FASES.map(f => (
            <button key={f.id}
              className={'aba-fase' + (faseAtiva === f.id ? ' on' : '')}
              style={faseAtiva === f.id ? { borderBottomColor: f.cor } : undefined}
              onClick={() => setFaseAtiva(f.id)}>
              {f.nome}
              <span className="aba-cont" style={{ background: f.cor }}>{porFase[f.id].length}</span>
            </button>
          ))}
        </div>
      )}

      {listaAtual.length === 0 && (
        <div style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0' }}>
          Nenhuma licitação {planas ? 'para exibir' : 'nesta fase'}.
        </div>
      )}

      {listaAtual.length > 0 && (
        <div className="lic-grid-header">
          <span>Edital / Objeto</span>
          <span>Data da sessão</span>
          <span>Valor estimado</span>
          <span>Itens</span>
          <span>Fase</span>
          <span>Status</span>
        </div>
      )}

      {listaAtual.map(l => {
        const fx = FASES.find(f => f.id === normalizarFase(l.fase || 'Em analise')) || FASES[0]
        const st = l.status || 'Aberta'
        const dd = diasAte(l.dataSessao || l.dataLimite)
        const urgente = dd !== null && dd >= 0 && dd <= 3 && !['Finalizada', 'Descartado'].includes(fx.id)
        return (
          <div key={l.id}>
            <div className="lic-grid-row" style={{ borderLeftColor: fx.cor }} onClick={() => setAberta(aberta === l.id ? null : l.id)}>
              <div className="lg-col1">
                <div className="lic-num">
                  {l.numeroEdital || 'Sem nº'}
                  {l.srp === 'Sim' && <span className="pill pill-gray" style={{ marginLeft: 6 }}>SRP</span>}
                </div>
                <div className="lic-obj">{l.objeto}</div>
                <div className="lic-meta">
                  {l.empresa_nome}{l.orgao ? ' · ' + l.orgao : ''}{l.uf ? '/' + l.uf : ''}
                  {l.modalidade ? ' · ' + l.modalidade : ''}{l.portal ? ' · ' + l.portal : ''}
                </div>
              </div>

              <div className="lg-col" style={urgente ? { color: '#DC2626', fontWeight: 700 } : undefined}>
                {l.dataSessao || l.dataLimite || l.dataAbertura || '—'}
                {urgente && <div style={{ fontSize: 10.5 }}>{dd === 0 ? 'hoje' : dd + 'd'}</div>}
              </div>

              <div className="lg-col">{l.valor || '—'}</div>

              <div className="lg-col">{l.itens?.length || 0}</div>

              <div className="lg-col">
                <span className="pill" style={{ background: fx.cor + '22', color: fx.cor }}>{fx.nome}</span>
              </div>

              <div className="lg-col">
                <span className="pill" style={{ background: corStatus(st) + '22', color: corStatus(st) }}>{nomeStatus(st)}</span>
                {l.resultado && l.resultado !== 'Aguardando' && (
                  <span className="pill" style={{ background: corResultado(l.resultado) + '22', color: corResultado(l.resultado), marginTop: 4 }}>
                    {nomeResultado(l.resultado)}
                  </span>
                )}
              </div>
            </div>

            {aberta === l.id && (
              <div className="detalhe-card" onClick={e => e.stopPropagation()}>
                <div className="detalhe-grid">
                  {[['Órgão', l.orgao], ['UF', l.uf], ['Modalidade', l.modalidade], ['Portal', l.portal],
                    ['Nº PNCP', l.numeroPNCP], ['Valor estimado', l.valor], ['Abertura', l.dataAbertura],
                    ['Limite da proposta', l.dataLimite], ['Sessão de disputa', l.dataSessao],
                    ['SRP', l.srp], ['Status', nomeStatus(st)]]
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
                  </div>
                )}

                {l.itens?.length > 0 && (
                  <div style={{ overflowX: 'auto', marginTop: 12 }}>
                    <table className="itens-tbl">
                      <thead><tr><th>Descrição</th><th>Qtd</th><th>Un</th>
                        <th style={{ textAlign: 'right' }}>Vl. estimado</th>
                        {l.itens.some(it => it.meuValor) && <th style={{ textAlign: 'right' }}>Nosso valor</th>}
                      </tr></thead>
                      <tbody>
                        {l.itens.map((it, i) => (
                          <tr key={i} style={{ opacity: it.participar === false ? .45 : 1 }}>
                            <td style={{ maxWidth: 320 }}>{it.descricao}</td>
                            <td>{it.quantidade}</td><td>{it.unidade}</td>
                            <td style={{ textAlign: 'right' }}>{it.valorUnitarioRef ? Number(it.valorUnitarioRef).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                            {l.itens.some(x => x.meuValor) && (
                              <td style={{ textAlign: 'right' }}>{it.meuValor ? Number(it.meuValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="iBtn">↗ Edital</a>}
                  {(l.anexos?.length ? l.anexos : (l.anexoDriveUrl ? [{ nome: 'Anexo', url: l.anexoDriveUrl }] : []))
                    .map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="iBtn">📎 {a.nome}</a>)}

                  {!somenteConsulta && <>
                    <select className="mover-fase-sel" value={fx.id} title="Mover para outra fase"
                      onChange={e => { if (e.target.value !== fx.id) onMover(l, e.target.value) }}>
                      {FASES.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                    <button className="iBtn" onClick={() => onChecklist(l)}>📋 Checklist</button>
                    <button className="iBtn" onClick={() => onStatus(l)}>🏁 Status</button>
                    <button className="iBtn" onClick={() => onEditar(l)}>✏️ Editar</button>
                    <button className="iBtn iBtn-del" onClick={() => onExcluir(l)}>🗑 Excluir</button>
                  </>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
