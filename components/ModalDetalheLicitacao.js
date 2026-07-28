'use client'
import { FASES } from '@/lib/fases'
import { nomeResultado, corResultado } from '@/lib/resultado'
import { nomeStatus } from '@/lib/statusLicitacao'

// Janela com os detalhes completos de uma licitação — antes isso expandia
// dentro da própria lista; agora abre à parte, sem empurrar as outras linhas.
export default function ModalDetalheLicitacao({
  lic, fx, somenteConsulta, onMover, onChecklist, onStatus, onEditar, onExcluir, onFechar,
}) {
  const l = lic
  const st = l.status || 'Aberta'
  // O checklist só faz sentido enquanto a decisão de participar ainda está em
  // aberto — da análise até a montagem da proposta. Depois disso, já foi usado.
  const mostrarChecklist = ['Em analise', 'Inscricao'].includes(fx.id)

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
            {[['Órgão', l.orgao], ['UF', l.uf], ['Modalidade', l.modalidade], ['Portal', l.portal],
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
            const temGrupos = l.itens.some(it => it.grupo)
            const grupos = temGrupos
              ? [...new Set(l.itens.map(it => it.grupo || 'Sem grupo'))]
              : [null]
            return (
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                {grupos.map((g, gi) => (
                  <div key={gi} style={{ marginBottom: temGrupos ? 14 : 0 }}>
                    {temGrupos && <div style={{ fontSize: 12, fontWeight: 800, color: '#145653', marginBottom: 6 }}>📦 Grupo: {g}</div>}
                    <table className="itens-tbl">
                      <thead><tr><th>Descrição</th><th>Qtd</th><th>Un</th>
                        <th style={{ textAlign: 'right' }}>Vl. estimado</th>
                        {l.itens.some(it => it.meuValor) && <th style={{ textAlign: 'right' }}>Valor mínimo</th>}
                      </tr></thead>
                      <tbody>
                        {l.itens.filter(it => !temGrupos || (it.grupo || 'Sem grupo') === g).map((it, i) => (
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
                ))}
              </div>
            )
          })()}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="iBtn">↗ Edital</a>}
          {(l.anexos?.length ? l.anexos : (l.anexoDriveUrl ? [{ nome: 'Anexo', url: l.anexoDriveUrl }] : []))
            .map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="iBtn">📎 {a.nome}</a>)}

          {!somenteConsulta && <>
            <select className="mover-fase-sel" value={fx.id} title="Mover para outra fase"
              onChange={e => { if (e.target.value !== fx.id) onMover(l, e.target.value) }}>
              {FASES.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
            {mostrarChecklist && <button className="iBtn" onClick={() => onChecklist(l)}>📋 Checklist</button>}
            <button className="iBtn" onClick={() => onStatus(l)}>📈 Andamento</button>
            <button className="iBtn" onClick={() => onEditar(l)}>✏️ Editar</button>
            <button className="iBtn iBtn-del" onClick={() => onExcluir(l)}>🗑 Excluir</button>
          </>}
        </div>
      </div>
    </div>
  )
}
