'use client'
import { useState } from 'react'
import { FASES, faseDe, FORMAS_VALOR } from '@/lib/fases'
import { RESULTADOS, MOTIVOS_NAO_PARTICIPACAO, MOTIVOS_PERDA } from '@/lib/resultado'

const moeda = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ModalStatus({ lic, onFechar, onSalvo }) {
  const [fase, setFase] = useState(lic.fase || 'Em analise')
  const [f, setF] = useState({
    resultado: lic.resultado || 'Aguardando',
    motivo: lic.motivo || '',
    nossoLance: lic.nossoLance || '',
    valorVencedor: lic.valorVencedor || '',
    empresaVencedora: lic.empresaVencedora || '',
    colocacao: lic.colocacao || '',
    observacaoDisputa: lic.observacaoDisputa || '',
    dataSessao: lic.dataSessao || '',
  })
  const [itens, setItens] = useState(() =>
    (lic.itens || []).map(it => ({
      ...it,
      participar: it.participar === undefined ? true : !!it.participar,
      meuValor: it.meuValor ?? '',
      formaValor: it.formaValor || 'unitario',
    })))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const setItem = (i, k, v) => setItens(a => a.map((it, j) => j === i ? { ...it, [k]: v } : it))

  const motivos = f.resultado === 'Nao participamos' ? MOTIVOS_NAO_PARTICIPACAO
    : (f.resultado === 'Perdemos' || f.resultado === 'Desclassificados') ? MOTIVOS_PERDA : null

  const marcados = itens.filter(it => it.participar)
  const semValor = marcados.filter(it => !String(it.meuValor).trim()).length

  async function salvar(faseDestino) {
    const destino = faseDestino || fase
    setSalvando(true); setErro('')
    try {
      const corpo = {
        id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto,
        fase: destino, ...f,
        itensJson: JSON.stringify(itens),
      }
      if (destino === 'Descartado') corpo.participar = 'Não'
      if (['Inscricao', 'Aguardando', 'Lances', 'Habilitacao'].includes(destino)) corpo.participar = 'Sim'
      if (['Ganhamos', 'Perdemos', 'Desclassificados', 'Deserta', 'Cancelada'].includes(f.resultado)) {
        corpo.status = 'Encerrada'
      }

      const r = await fetch('/api/licitacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
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
            <div className="modal-hdr-sub">STATUS DA LICITAÇÃO</div>
            <div className="modal-hdr-title">{lic.numeroEdital || 'Licitação'}</div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>
              {String(lic.objeto || '').slice(0, 90)}
            </div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>

        <div className="modal-body">
          {/* Trilha de fases — mudar aqui move o cartão no quadro */}
          <div className="form-sub">
            <label>FASE ATUAL</label>
            <div className="trilha">
              {FASES.map(x => (
                <button key={x.id}
                  className={'trilha-item' + (fase === x.id ? ' on' : '')}
                  style={fase === x.id ? { background: x.cor, borderColor: x.cor } : { borderColor: x.cor + '55' }}
                  onClick={() => setFase(x.id)}>
                  <span className="trilha-nome">{x.nome}</span>
                  <span className="trilha-desc">{x.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Inscrição de proposta: escolher itens e preços ── */}
          {fase === 'Inscricao' && (
            <div className="form-sub">
              <label>ITENS EM QUE VAMOS PARTICIPAR E NOSSOS VALORES</label>
              {itens.length === 0 && (
                <div className="aviso-box">
                  Nenhum item cadastrado. Feche e use "Importar do PNCP" na edição da licitação.
                </div>
              )}
              {itens.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl-proposta">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>Vou</th>
                        <th>Descrição</th>
                        <th style={{ width: 70 }}>Qtd</th>
                        <th style={{ width: 60 }}>Un</th>
                        <th style={{ width: 110 }}>Estimado</th>
                        <th style={{ width: 120 }}>Meu valor</th>
                        <th style={{ width: 120 }}>Forma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => (
                        <tr key={i} style={{ opacity: it.participar ? 1 : .45 }}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={it.participar}
                              onChange={e => setItem(i, 'participar', e.target.checked)} />
                          </td>
                          <td style={{ maxWidth: 320 }}>{it.descricao || '—'}</td>
                          <td>{it.quantidade || '—'}</td>
                          <td>{it.unidade || '—'}</td>
                          <td style={{ color: '#64748B' }}>
                            {it.valorUnitarioRef ? moeda(it.valorUnitarioRef) : '—'}
                          </td>
                          <td>
                            <input type="number" step="0.01" value={it.meuValor}
                              disabled={!it.participar}
                              onChange={e => setItem(i, 'meuValor', e.target.value)} placeholder="0,00" />
                          </td>
                          <td>
                            <select value={it.formaValor} disabled={!it.participar}
                              onChange={e => setItem(i, 'formaValor', e.target.value)}>
                              {FORMAS_VALOR.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="dica-menus">
                {marcados.length} de {itens.length} itens marcados
                {semValor > 0 && ` · ${semValor} ainda sem valor`}
              </p>
            </div>
          )}

          {/* ── Aguardando: data e hora da sessão ── */}
          {['Aguardando', 'Lances'].includes(fase) && (
            <div className="form-sub">
              <label>DATA E HORA DA SESSÃO DE DISPUTA</label>
              <input value={f.dataSessao} onChange={e => set('dataSessao', e.target.value)}
                placeholder="dd/mm/aaaa hh:mm" />
              <p className="dica-menus">
                Chegando esse horário, a licitação passa sozinha para "Fase de lances".
                Em branco, vale o limite da proposta ({lic.dataLimite || 'não informado'}).
              </p>
            </div>
          )}

          {/* ── Lances: nosso lance ── */}
          {fase === 'Lances' && (
            <div className="form-sub">
              <label>NOSSO ÚLTIMO LANCE (R$)</label>
              <input type="number" step="0.01" value={f.nossoLance} onChange={e => set('nossoLance', e.target.value)} />
            </div>
          )}

          {/* ── Habilitação: colocação e vencedor ── */}
          {['Habilitacao', 'Finalizada'].includes(fase) && (
            <div className="form-grid">
              <div><label className="mini-lbl">NOSSA COLOCAÇÃO</label>
                <input type="number" min="1" value={f.colocacao} onChange={e => set('colocacao', e.target.value)} placeholder="1" /></div>
              <div><label className="mini-lbl">NOSSO LANCE (R$)</label>
                <input type="number" step="0.01" value={f.nossoLance} onChange={e => set('nossoLance', e.target.value)} /></div>
              <div><label className="mini-lbl">EMPRESA VENCEDORA</label>
                <input value={f.empresaVencedora} onChange={e => set('empresaVencedora', e.target.value)} placeholder="Nome do concorrente" /></div>
              <div><label className="mini-lbl">PREÇO DA VENCEDORA (R$)</label>
                <input type="number" step="0.01" value={f.valorVencedor} onChange={e => set('valorVencedor', e.target.value)} /></div>
            </div>
          )}

          {/* ── Finalizada / Descartado: resultado e motivo ── */}
          {['Finalizada', 'Descartado'].includes(fase) && (
            <>
              <div className="form-sub">
                <label>COMO TERMINOU?</label>
                <div className="chip-group">
                  {RESULTADOS.map(r => (
                    <button key={r.id}
                      className={'chip-opt' + (f.resultado === r.id ? ' on' : '')}
                      onClick={() => set('resultado', r.id)}>{r.nome}</button>
                  ))}
                </div>
              </div>
              {motivos && (
                <div className="form-sub">
                  <label>MOTIVO</label>
                  <select value={f.motivo} onChange={e => set('motivo', e.target.value)}>
                    <option value="">Selecione...</option>
                    {motivos.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="form-sub">
            <label>OBSERVAÇÕES</label>
            <textarea rows={2} value={f.observacaoDisputa} onChange={e => set('observacaoDisputa', e.target.value)} />
          </div>

          {erro && <div className="l-err" style={{ marginTop: 10 }}>{erro}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          {/* Atalho pedido: da inscrição, concluir e já ir para a disputa */}
          {fase === 'Inscricao' && (
            <button className="btn-primary" style={{ marginTop: 0, background: '#8B5CF6' }}
              disabled={salvando || marcados.length === 0}
              onClick={() => salvar('Aguardando')}>
              {salvando ? 'Salvando...' : 'Proposta pronta → Aguardando disputa'}
            </button>
          )}
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => salvar()} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar status'}
          </button>
        </div>
      </div>
    </div>
  )
}
