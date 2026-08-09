'use client'
import { useState } from 'react'
import { FASES } from '@/lib/fases'
import { nomeResultado, corResultado } from '@/lib/resultado'
import { nomeStatus } from '@/lib/statusLicitacao'
import Toggle from '@/components/Toggle'

// Janela com os detalhes completos de uma licitação — antes isso expandia
// dentro da própria lista; agora abre à parte, sem empurrar as outras linhas.
export default function ModalDetalheLicitacao({
  lic, fx, somenteConsulta, onMover, onStatus, onEditar, onExcluir, onFechar,
}) {
  const l = lic
  const st = l.status || 'Aberta'
  // Por padrão só mostra os itens marcados como "vou participar" — em
  // licitações com dezenas de itens, ver todos de uma vez atrapalha
  const temParticipacaoDefinida = (l.itens || []).some(it => it.participar !== undefined)
  const [somenteParticipando, setSomenteParticipando] = useState(temParticipacaoDefinida)

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal modal-lg">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">LICITAÇÃO</div>
            <div className="modal-hdr-title">{l.numeroEdital || 'Sem nº'} — {l.orgao}</div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>
              {l.empresa_nome}{l.uf ? '/' + l.uf : ''}
            </div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: fx.cor + '22', color: fx.cor }}>{fx.nome}</span>
            <span className="pill" style={{ background: '#F1F5F9', color: '#475569' }}>{nomeStatus(st)}</span>
            {l.resultado && l.resultado !== 'Aguardando' && (
              <span className="pill" style={{ background: corResultado(l.resultado) + '22', color: corResultado(l.resultado) }}>
                🏁 {nomeResultado(l.resultado)}
              </span>
            )}
          </div>

          <div className="detalhe-grid">
            {[['Órgão', l.orgao], ['UASG', l.uasg], ['UF', l.uf], ['Modalidade', l.modalidade], ['Portal', l.portal],
              ['Nº PNCP', l.numeroPNCP], ['Valor estimado', l.valor], ['Abertura', l.dataAbertura],
              ['Limite da proposta', l.dataLimite], ['Sessão de disputa', l.dataSessao], ['SRP', l.srp]]
              .filter(x => x[1]).map(x => (
                <div key={x[0]}><span className="dt-lbl">{x[0]}</span><span className="dt-val">{x[1]}</span></div>
              ))}
          </div>
          {l.objeto && <p style={{ marginTop: 10 }}><strong>Objeto:</strong> {l.objeto}</p>}

          {l.resultado && l.resultado !== 'Aguardando' && (
            <div className="bloco-disputa" style={{ borderColor: corResultado(l.resultado) }}>
              <strong style={{ color: corResultado(l.resultado) }}>🏁 {nomeResultado(l.resultado)}</strong>
              {l.dataHomologacao && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400 }}>homologada em {l.dataHomologacao}</span>}
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

          {l.itens?.length > 0 && (() => {
            const itensBase = somenteParticipando ? l.itens.filter(it => it.participar !== false) : l.itens
            const temGrupos = itensBase.some(it => it.grupo)
            const grupos = temGrupos
              ? [...new Set(itensBase.map(it => it.grupo || 'Sem grupo'))]
              : [null]
            return (
              <div style={{ marginTop: 12 }}>
                {temParticipacaoDefinida && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      {itensBase.length} de {l.itens.length} itens
                    </span>
                    <Toggle ligado={somenteParticipando} onChange={setSomenteParticipando} label="Somente participando" />
                  </div>
                )}
                {itensBase.length === 0 && (
                  <div style={{ color: '#94A3B8', fontSize: 12.5, padding: '10px 0' }}>
                    Nenhum item marcado para participar ainda — desligue o filtro acima para ver todos.
                  </div>
                )}
              <div style={{ overflowX: 'auto' }}>
                {grupos.map((g, gi) => (
                  <div key={gi} style={{ marginBottom: temGrupos ? 14 : 0 }}>
                    {temGrupos && <div style={{ fontSize: 12, fontWeight: 800, color: '#145653', marginBottom: 6 }}>📦 Grupo: {g}</div>}
                    <table className="itens-tbl">
                      <thead><tr><th>Descrição</th><th>Qtd</th><th>Un</th>
                        <th style={{ textAlign: 'right' }}>Vl. estimado</th>
                        {itensBase.some(it => it.meuValor) && <th style={{ textAlign: 'right' }}>Valor mínimo</th>}
                        {itensBase.some(it => it.lanceFinal) && <th style={{ textAlign: 'right' }}>Nosso lance</th>}
                        {itensBase.some(it => it.colocacao) && <th>Colocação</th>}
                        {itensBase.some(it => it.vencedorNome || it.vencedorPreco) && <th>Vencedor</th>}
                      </tr></thead>
                      <tbody>
                        {itensBase.filter(it => !temGrupos || (it.grupo || 'Sem grupo') === g).map((it, i) => (
                          <tr key={i} style={{ opacity: it.participar === false ? .45 : 1 }}>
                            <td style={{ maxWidth: 320 }}>{it.descricao}</td>
                            <td>{it.quantidade}</td><td>{it.unidade}</td>
                            <td style={{ textAlign: 'right' }}>{it.valorUnitarioRef ? Number(it.valorUnitarioRef).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sigiloso'}</td>
                            {itensBase.some(x => x.meuValor) && (
                              <td style={{ textAlign: 'right' }}>
                                {it.meuValor
                                  ? (it.formaValor === 'desconto'
                                      ? it.meuValor + '% desc.'
                                      : Number(it.meuValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
                                  : '—'}
                              </td>
                            )}
                            {itensBase.some(x => x.lanceFinal) && (
                              <td style={{ textAlign: 'right' }}>{it.lanceFinal ? Number(it.lanceFinal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                            )}
                            {itensBase.some(x => x.colocacao) && <td>{it.colocacao || '—'}</td>}
                            {itensBase.some(x => x.vencedorNome || x.vencedorPreco) && (
                              <td>{it.vencedorNome || '—'}{it.vencedorPreco ? ' · ' + Number(it.vencedorPreco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {itensBase.some(it => it.lanceFinal) && (
                      <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: '#16A34A', marginTop: 6 }}>
                        Total dos nossos lances: {itensBase.filter(it => !temGrupos || (it.grupo || 'Sem grupo') === g)
                          .reduce((s, it) => s + (Number(it.lanceFinal || it.meuValor) || 0) * (Number(it.quantidade) || 0), 0)
                          .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </div>
            )
          })()}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="iBtn">↗ Edital</a>}
          <a href={`/dashboard/licitacoes/resumo?id=${l.id}`} target="_blank" rel="noreferrer" className="iBtn">📄 Resumo (PDF)</a>
          {(l.anexos?.length ? l.anexos : (l.anexoDriveUrl ? [{ nome: 'Anexo', url: l.anexoDriveUrl }] : []))
            .map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="iBtn">📎 {a.nome}</a>)}

          {!somenteConsulta && <>
            <select className="mover-fase-sel" value={fx.id} title="Mover para outra fase"
              onChange={e => { if (e.target.value !== fx.id) onMover(l, e.target.value) }}>
              {FASES.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
            <button className="iBtn" onClick={() => onStatus(l)}>📈 Andamento</button>
            <button className="iBtn" onClick={() => onEditar(l)}>✏️ Editar</button>
            <button className="iBtn iBtn-del" onClick={() => onExcluir(l)}>🗑 Excluir</button>
          </>}
        </div>
      </div>
    </div>
  )
}
