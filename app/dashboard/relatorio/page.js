'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { nomeResultado, corResultado, mesDe } from '@/lib/resultado'
import { faseDe } from '@/lib/fases'
import { fmtBRL } from '@/lib/comercial'

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const brl = v => v ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'

// Data que de fato representa "quando" a licitação acontece: a sessão, se
// já tiver sido ajustada; senão o limite da proposta; senão a abertura.
// Nunca usar dataAbertura sozinha — ela só marca o início do prazo.
const dataRef = l => l.dataSessao || l.dataLimite || l.dataAbertura

// Rótulo de status pro relatório, no mesmo espírito da planilha do Adriano
// (VENCEDOR, PERDIDA, NÃO PARTICIPAÇÃO, PARTICIPAR...)
const statusRelatorio = l => {
  if (l.resultado === 'Ganhamos') return 'VENCEDOR'
  if (['Perdemos', 'Desclassificados'].includes(l.resultado)) return 'PERDIDA'
  if (l.resultado === 'Nao participamos') return 'NÃO PARTICIPAÇÃO'
  if (l.resultado === 'Deserta') return 'DESERTA/FRACASSADA'
  if (l.resultado === 'Cancelada') return 'CANCELADA/SUSPENSA'
  return 'PARTICIPAR'
}

// Valor com que efetivamente disputamos um item (ganhando ou perdendo): o
// lance final registrado na fase "Finalizada", ou o valor mínimo proposto
// (convertendo % de desconto pro preço equivalente, quando for o caso).
const valorVencidoItem = it => {
  if (it.lanceFinal) return Number(it.lanceFinal) || 0
  const estimado = Number(it.valorUnitarioRef) || 0
  const v = Number(it.meuValor) || 0
  return it.formaValor === 'desconto' ? estimado * (1 - v / 100) : v
}

// Valor da nossa proposta pra licitação inteira — soma dos itens
// participando quando há itens cadastrados, senão o campo único de lance
// (nossoLance), usado tanto pra vitórias quanto pra derrotas.
const valorNossoTotal = l => {
  const marcados = (l.itens || []).filter(it => it.participar)
  if (marcados.length) {
    return marcados.reduce((s, it) => s + (Number(it.quantidade) || 0) * valorVencidoItem(it), 0)
  }
  return Number(l.nossoLance) || 0
}

// Valor estimado só dos itens em que vamos/fomos participar — quando há
// itens cadastrados. Sem itens, usa o campo único "valor" da licitação.
const valorEstimadoTotal = l => {
  const marcados = (l.itens || []).filter(it => it.participar)
  if (marcados.length) {
    return marcados.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valorUnitarioRef) || 0), 0)
  }
  return Number(String(l.valor || '').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
}

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
    ]).then(([l, e]) => {
      if (!l.sucesso) { setErro(l.erro || 'Erro ao carregar.'); return }
      setDados({ lics: l.licitacoes, empenhos: e.sucesso ? e.empenhos : [] })
    }).catch(() => setErro('Erro de conexão.'))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresa = empresaSel ? empresas.find(e => String(e.id) === empresaSel) : null

  const rel = useMemo(() => {
    if (!dados || !empresaSel) return null
    const todasDaEmpresa = dados.lics.filter(l => l.empresa_id === empresaSel)
    const empenhos = dados.empenhos.filter(e => e.empresa_id === empresaSel && mesDe(e.dataEmpenho) === mes)

    const comDesfecho = l => l.resultado && l.resultado !== 'Aguardando'

    // Para quem já tem desfecho, o mês do relatório é definido pela DATA DE
    // HOMOLOGAÇÃO (é o campo que a própria tela de Andamento explica: "é o
    // mês em que a licitação entra no relatório, não o mês em que foi
    // aberta"). Só cai pra sessão/limite/abertura se não tiver homologação
    // registrada (ex: "Não participamos", que não passa por homologação).
    const mesDoDesfecho = l => mesDe(l.dataHomologacao) || mesDe(dataRef(l))

    // "Oportunidades analisadas" = o que teve desfecho neste mês (pela
    // homologação) + o que ainda está pendente com sessão/limite/abertura
    // neste mês — ou seja, todo mundo que fez parte do trabalho do mês.
    const decididasNoMes = todasDaEmpresa.filter(l => comDesfecho(l) && mesDoDesfecho(l) === mes)
    const pendentesNoMes = todasDaEmpresa.filter(l => !comDesfecho(l) && mesDe(dataRef(l)) === mes)
    const lics = [...decididasNoMes, ...pendentesNoMes]

    // O "em andamento" mostra o que ainda está sem desfecho até o último dia
    // do mês do relatório (olhando pra trás) — nunca usa a data de hoje,
    // porque o relatório pode ser gerado bem depois do mês em questão. Isso
    // deixa de fora sessões futuras já agendadas além do mês do relatório.
    const aguardando = todasDaEmpresa.filter(l => {
      if (comDesfecho(l)) return false
      const m = mesDe(dataRef(l))
      return !m || m <= mes
    })

    const disputadas = lics.filter(l => ['Ganhamos', 'Perdemos', 'Desclassificados'].includes(l.resultado))
    const ganhas = lics.filter(l => l.resultado === 'Ganhamos')
    const perdidas = lics.filter(l => ['Perdemos', 'Desclassificados'].includes(l.resultado))
    const naoParticipamos = lics.filter(l => l.resultado === 'Nao participamos')

    const taxa = disputadas.length ? (ganhas.length / disputadas.length) * 100 : 0

    // Lista única pro relatório: tudo que entrou no mês (decididas + pendentes
    // do mês) mais o que ficou em andamento de meses anteriores — sem repetir,
    // ordenado por data (mais antiga primeiro), do jeito que vai pro cliente.
    const porId = new Map()
    ;[...lics, ...aguardando].forEach(l => porId.set(l.id, l))
    const todasNoRelatorio = [...porId.values()].sort((a, b) => {
      const da = dataRef(a).split(' ')[0].split('/').reverse().join('') || '00000000'
      const db = dataRef(b).split(' ')[0].split('/').reverse().join('') || '00000000'
      return da.localeCompare(db)
    })

    return {
      lics, disputadas, ganhas, perdidas, naoParticipamos, aguardando, todasNoRelatorio,
      taxa,
      faturamento: empenhos.reduce((s, e) => s + e.faturamento, 0),
      receita: empenhos.reduce((s, e) => s + e.receita, 0),
      empenhos,
    }
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

          {(rel.faturamento > 0 || rel.receita > 0) && (
            <>
              <h2 className="rel-h2">1. Resultado financeiro do período</h2>
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
              <h2 className="rel-h2">2. Licitações do período</h2>
              <table className="rel-tabela rel-tabela-larga">
                <thead>
                  <tr>
                    <th>Data</th><th>Portal</th><th>Edital / Objeto</th><th>UF</th>
                    <th>Fase</th><th>Status</th><th>Nº proposta</th>
                    <th style={{ textAlign: 'right' }}>Valor estimado</th><th style={{ textAlign: 'right' }}>Nosso valor</th>
                    <th>Observações</th><th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.todasNoRelatorio.map(l => {
                    const nosso = valorNossoTotal(l)
                    const estimado = valorEstimadoTotal(l)
                    const fx = faseDe(l.fase || 'Em analise')
                    return (
                    <tr key={l.id} style={l.resultado === 'Ganhamos' ? { background: '#DCFCE7' } : undefined}>
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
                      <td style={{ textAlign: 'right' }}>{estimado ? brl(estimado) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{nosso ? brl(nosso) : '—'}</td>
                      <td style={{ maxWidth: 260 }}>
                        {l.motivo && <div>{l.motivo}</div>}
                        {l.observacaoDisputa && <div>{l.observacaoDisputa}</div>}
                        {!l.motivo && !l.observacaoDisputa && '—'}
                      </td>
                      <td>{l.link ? <a href={l.link} target="_blank" rel="noreferrer">abrir</a> : '—'}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </>
          )}

          {rel.ganhas.length > 0 && (
            <>
              <h2 className="rel-h2">3. Detalhamento das vitórias</h2>
              {rel.ganhas.map(l => {
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
                      <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Vl. estimado</th><th style={{ textAlign: 'right' }}>Valor que vencemos</th></tr></thead>
                      <tbody>
                        {itensParticipando.map((it, i) => (
                          <tr key={i}>
                            <td style={{ maxWidth: 320 }}>{it.descricao}</td>
                            <td style={{ textAlign: 'right' }}>{it.valorUnitarioRef ? brl(it.valorUnitarioRef) : 'Sigiloso'}</td>
                            <td style={{ textAlign: 'right' }}>{brl(valorVencidoItem(it))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="rel-lic-disputa">
                      {l.valor && <>Valor estimado: <strong>{l.valor}</strong></>}
                      {l.nossoLance && <> · Nosso lance: <strong>{brl(l.nossoLance)}</strong></>}
                      {l.valorVencedor && <> · Vencedor: <strong>{brl(l.valorVencedor)}</strong>{l.empresaVencedora ? ' (' + l.empresaVencedora + ')' : ''}</>}
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
