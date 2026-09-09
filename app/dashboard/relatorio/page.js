'use client'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { nomeResultado, corResultado } from '@/lib/resultado'
import { faseDe } from '@/lib/fases'
import { fmtBRL } from '@/lib/comercial'
import {
  MESES, brl, dataRef, statusRelatorio, valorVencidoItem, valorNossoTotal,
  valorEstimadoTotal, calcularRelatorio,
} from '@/lib/relatorio'
import EnviarRelatorioEmail from '@/components/EnviarRelatorioEmail'

export default function RelatorioPage() {
  const { empresaAtual, empresas } = useApp()
  const hoje = new Date()
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    Promise.all([
      fetch('/api/licitacoes').then(r => r.json()),
      fetch('/api/empenhos').then(r => r.json()),
      fetch(`/api/licitacoes/cotacao?empresaId=${empresaAtual}`).then(r => r.json()).catch(() => null),
    ]).then(([l, e, c]) => {
      if (!l.sucesso) { setErro(l.erro || 'Erro ao carregar.'); return }
      setDados({ lics: l.licitacoes, empenhos: e.sucesso ? e.empenhos : [], cotacoes: c?.sucesso ? c.cotacoes : [] })
    }).catch(() => setErro('Erro de conexão.'))
  }, [empresaAtual])

  useEffect(() => { carregar() }, [carregar])

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresa = empresaSel ? empresas.find(e => String(e.id) === empresaSel) : null

  const rel = useMemo(() => {
    if (!dados || !empresaSel) return null
    return calcularRelatorio({ lics: dados.lics, empenhos: dados.empenhos, cotacoes: dados.cotacoes, empresaSel, mes })
  }, [dados, empresaSel, mes])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const [ano, mm] = mes.split('-')
  const rotuloMes = `${MESES[Number(mm) - 1]} de ${ano}`

  const opcoesMes = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    opcoesMes.push({
      v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      l: `${MESES[d.getMonth()]}/${d.getFullYear()}`,
    })
  }

  return (
    <div>
      <div className="nao-imprimir">
        <h2 className="sec-title">Relatório mensal</h2>
        <p className="sec-sub">Monitoramento e resultados para apresentar ao cliente</p>

        <div className="form-card">
          <div className="filtro-linha">
            <div>
              <label className="mini-lbl">MÊS DE REFERÊNCIA</label>
              <select value={mes} onChange={e => setMes(e.target.value)}>
                {opcoesMes.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => window.print()} disabled={!rel}>
              🖨️ Imprimir / Salvar em PDF
            </button>
          </div>
          {rel && empresaSel && (
            <EnviarRelatorioEmail empresaId={empresaSel} empresa={empresa} mes={mes} />
          )}
          <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 10 }}>
            Na janela de impressão, escolha <strong>Destino: Salvar como PDF</strong> para gerar o arquivo que vai ao cliente.
          </p>
        </div>

        {!empresaSel && (
          <div className="aviso-box">Selecione uma empresa no menu lateral para gerar o relatório.</div>
        )}
      </div>

      {rel && (
        <div className="relatorio">
          <div className="rel-cabecalho">
            <div>
              <div className="rel-marca">⚡ ATHOS LICITA</div>
              <h1>Relatório de Monitoramento de Licitações</h1>
              <p>{empresa?.nome} · {rotuloMes}</p>
            </div>
            <div className="rel-contato">
              Adriano Ribeiro Bragança<br />
              licita.athos@gmail.com<br />
              (21) 99763-9451
            </div>
          </div>

          <h2 className="rel-h2">1. Resumo do período</h2>
          <p className="rel-texto">
            Em {rotuloMes}, participamos de <strong>{rel.disputadas.length}</strong> licitaç{rel.disputadas.length === 1 ? 'ão' : 'ões'} com
            resultado definido: vencemos <strong>{rel.ganhas.length}</strong> e perdemos <strong>{rel.perdidas.length}</strong>
            {rel.disputadas.length > 0 && <> (taxa de sucesso de <strong>{rel.taxa.toFixed(0)}%</strong>)</>}.
            {rel.naoParticipamos.length > 0 && <> Decidimos não participar de <strong>{rel.naoParticipamos.length}</strong> oportunidade{rel.naoParticipamos.length === 1 ? '' : 's'} analisada{rel.naoParticipamos.length === 1 ? '' : 's'}.</>}
            {' '}Além disso, <strong>{rel.aguardando.length}</strong> licitaç{rel.aguardando.length === 1 ? 'ão segue' : 'ões seguem'} em andamento.
          </p>
          <div className="rel-kpis">
            <div><strong>{rel.disputadas.length}</strong><span>participadas</span></div>
            <div><strong>{rel.ganhas.length}</strong><span>vencidas</span></div>
            <div><strong>{rel.perdidas.length}</strong><span>perdidas</span></div>
            <div><strong>{rel.aguardando.length}</strong><span>em andamento</span></div>
          </div>

          {(rel.faturamento > 0 || rel.receita > 0) && (
            <>
              <h2 className="rel-h2">2. Resultado financeiro do período</h2>
              <div className="rel-kpis">
                <div><strong>{fmtBRL(rel.faturamento)}</strong><span>faturamento empenhado</span></div>
                <div><strong>{rel.empenhos.length}</strong><span>notas de empenho</span></div>
              </div>
              {rel.empenhos.length > 0 && (
                <table className="rel-tabela">
                  <thead><tr><th>Nº Empenho</th><th>Data</th><th>Ata / Órgão</th><th style={{ textAlign: 'right' }}>Valor</th><th>Situação</th></tr></thead>
                  <tbody>
                    {rel.empenhos.map(e => (
                      <tr key={e.id}>
                        <td>{e.numeroEmpenho}</td><td>{e.dataEmpenho}</td>
                        <td>{e.numeroAta ? 'Ata ' + e.numeroAta + ' — ' : ''}{e.orgao}</td>
                        <td style={{ textAlign: 'right' }}>{fmtBRL(e.faturamento)}</td>
                        <td>{e.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {rel.todasNoRelatorio.length > 0 && (
            <>
              <h2 className="rel-h2">3. Licitações do período</h2>
              <table className="rel-tabela rel-tabela-larga">
                <thead>
                  <tr>
                    <th>Data</th><th>Portal</th><th>Edital / Objeto</th><th>UF</th>
                    <th>Fase</th><th>Status</th><th>Nº proposta</th><th>Nº cotação</th>
                    <th style={{ textAlign: 'right' }}>Valor estimado</th><th style={{ textAlign: 'right' }}>Nosso valor</th>
                    <th>Observações</th><th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.todasNoRelatorio.map((l, i, arr) => {
                    const nosso = valorNossoTotal(l)
                    const estimado = valorEstimadoTotal(l)
                    const fx = faseDe(l.fase || 'Em analise')
                    const faseAnterior = i > 0 ? faseDe(arr[i - 1].fase || 'Em analise').id : null
                    const cotNums = rel.cotacoesPorLic.get(l.id) || []
                    return (
                    <Fragment key={l.id}>
                      {fx.id !== faseAnterior && (
                        <tr className="rel-fase-sep" key={'fase-' + fx.id}>
                          <td colSpan={12} style={{ background: fx.cor + '1A', color: fx.cor, fontWeight: 700, fontSize: 11.5 }}>
                            {fx.nome.toUpperCase()}
                          </td>
                        </tr>
                      )}
                      <tr style={l.resultado === 'Ganhamos' ? { background: '#DCFCE7' } : undefined}>
                        <td style={{ whiteSpace: 'nowrap' }}>{(dataRef(l) || '').split(' ')[0] || '—'}</td>
                        <td>{l.portal || '—'}</td>
                        <td style={{ maxWidth: 320 }}>
                          <strong>{l.numeroEdital || 'Sem nº'}</strong>{l.orgao ? ' - ' + l.orgao : ''}
                          {l.uasg ? ' (UASG ' + l.uasg + ')' : ''}
                          {l.objeto && <div style={{ color: '#64748B', fontWeight: 400 }}>{l.objeto}</div>}
                        </td>
                        <td>{l.uf || '—'}</td>
                        <td>{fx.nome}</td>
                        <td style={{ fontWeight: 700, color: corResultado(l.resultado) }}>{statusRelatorio(l)}</td>
                        <td>{l.numeroProposta || '—'}</td>
                        <td>{cotNums.length ? cotNums.join(', ') : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{estimado ? brl(estimado) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{nosso ? brl(nosso) : '—'}</td>
                        <td style={{ maxWidth: 260 }}>
                          {l.motivo && <div>{l.motivo}</div>}
                          {l.observacaoDisputa && <div>{l.observacaoDisputa}</div>}
                          {!l.motivo && !l.observacaoDisputa && '—'}
                        </td>
                        <td>{l.link ? <a href={l.link} target="_blank" rel="noreferrer">abrir</a> : '—'}</td>
                      </tr>
                    </Fragment>
                  )})}
                </tbody>
              </table>
            </>
          )}

          {rel.comDetalheItens.length > 0 && (
            <>
              <h2 className="rel-h2">4. Detalhamento por item — vitórias e derrotas</h2>
              {rel.comDetalheItens.map(l => {
                const itensParticipando = (l.itens || []).filter(it => it.participar)
                return (
                <div className="rel-lic" key={l.id} style={{ borderLeftColor: corResultado(l.resultado) }}>
                  <div className="rel-lic-tit">
                    {l.numeroEdital || 'Sem nº'} — {l.orgao}{l.uf ? '/' + l.uf : ''}
                    <span style={{ color: corResultado(l.resultado) }}>{nomeResultado(l.resultado)}</span>
                  </div>
                  <div className="rel-lic-meta">
                    {l.modalidade}{l.portal ? ' · ' + l.portal : ''}{dataRef(l) ? ' · sessão em ' + dataRef(l).split(' ')[0] : ''}
                  </div>
                  {itensParticipando.length > 0 ? (
                    <table className="rel-tabela" style={{ marginTop: 6 }}>
                      <thead>
                        <tr>
                          <th>Item</th><th>Colocação</th><th>Situação</th>
                          <th style={{ textAlign: 'right' }}>Vl. estimado</th>
                          <th style={{ textAlign: 'right' }}>Nosso valor mínimo</th>
                          <th style={{ textAlign: 'right' }}>Valor do 1º colocado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensParticipando.map((it, i) => {
                          const colocacao = Number(it.colocacao) || null
                          const venceuItem = colocacao === 1 || (!colocacao && l.resultado === 'Ganhamos')
                          const nossoValor = valorVencidoItem(it)
                          // Preço do 1º colocado: se já ganhamos (colocação 1), é o nosso
                          // próprio valor; senão é o preço do concorrente registrado no item.
                          const valor1oColocado = venceuItem ? nossoValor : (Number(it.vencedorPreco) || null)
                          return (
                            <tr key={i} style={venceuItem ? { background: '#DCFCE7' } : undefined}>
                              <td style={{ maxWidth: 280 }}>{it.descricao}</td>
                              <td>{colocacao ? colocacao + 'º' : '—'}</td>
                              <td style={{ fontWeight: 700, color: venceuItem ? '#16A34A' : '#DC2626' }}>
                                {venceuItem ? 'Vencido' : 'Perdido'}
                              </td>
                              <td style={{ textAlign: 'right' }}>{it.valorUnitarioRef ? brl(it.valorUnitarioRef) : 'Sigiloso'}</td>
                              <td style={{ textAlign: 'right' }}>{brl(nossoValor)}</td>
                              <td style={{ textAlign: 'right' }}>{valor1oColocado ? brl(valor1oColocado) : '—'}{it.vencedorNome && !venceuItem ? <div style={{ fontWeight: 400, color: '#64748B' }}>{it.vencedorNome}</div> : null}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="rel-lic-disputa">
                      {l.valor && <>Valor estimado: <strong>{l.valor}</strong></>}
                      {l.nossoLance && <> · Nosso valor mínimo: <strong>{brl(l.nossoLance)}</strong></>}
                      {l.valorVencedor && <> · Valor do 1º colocado: <strong>{brl(l.valorVencedor)}</strong>{l.empresaVencedora ? ' (' + l.empresaVencedora + ')' : ''}</>}
                      {l.colocacao && <> · Nossa colocação: {l.colocacao}º</>}
                      {!l.valor && !l.nossoLance && !l.valorVencedor && !l.colocacao && (
                        <span style={{ color: '#94A3B8' }}>Sem itens marcados como participando nem valores de lance registrados nesta licitação — confira a fase "Inscrição de proposta" no Andamento.</span>
                      )}
                    </div>
                  )}
                  {l.observacaoDisputa && <div className="rel-lic-obs">{l.observacaoDisputa}</div>}
                </div>
              )})}
            </>
          )}

          {rel.todasNoRelatorio.length === 0 && rel.empenhos.length === 0 && (
            <p className="rel-texto">Não há registros para {empresa?.nome} em {rotuloMes}.</p>
          )}

          <div className="rel-rodape">
            Athos Licita · Consultoria em Licitações Públicas · Lei 14.133/2021<br />
            licita.athos@gmail.com · (21) 99763-9451 · @athoslicita
          </div>
        </div>
      )}
    </div>
  )
}
