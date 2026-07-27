'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { nomeResultado, corResultado, mesDe } from '@/lib/resultado'
import { fmtBRL } from '@/lib/comercial'

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const brl = v => v ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'

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
      fetch('/api/certidoes').then(r => r.json()),
    ]).then(([l, e, c]) => {
      if (!l.sucesso) { setErro(l.erro || 'Erro ao carregar.'); return }
      setDados({ lics: l.licitacoes, empenhos: e.sucesso ? e.empenhos : [], certidoes: c.sucesso ? c.certidoes : [] })
    }).catch(() => setErro('Erro de conexão.'))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresa = empresaSel ? empresas.find(e => String(e.id) === empresaSel) : null

  const rel = useMemo(() => {
    if (!dados || !empresaSel) return null
    const lics = dados.lics.filter(l => l.empresa_id === empresaSel && mesDe(l.dataAbertura) === mes)
    const empenhos = dados.empenhos.filter(e => e.empresa_id === empresaSel && mesDe(e.dataEmpenho) === mes)

    const disputadas = lics.filter(l => ['Ganhamos', 'Perdemos', 'Desclassificados'].includes(l.resultado))
    const ganhas = lics.filter(l => l.resultado === 'Ganhamos')
    const perdidas = lics.filter(l => ['Perdemos', 'Desclassificados'].includes(l.resultado))
    const naoParticipamos = lics.filter(l => l.resultado === 'Nao participamos')
    const aguardando = lics.filter(l => !l.resultado || l.resultado === 'Aguardando')

    // Agrupa os motivos de não participação
    const motivos = {}
    naoParticipamos.forEach(l => {
      const k = l.motivo || 'Não informado'
      motivos[k] = (motivos[k] || 0) + 1
    })

    const taxa = disputadas.length ? (ganhas.length / disputadas.length) * 100 : 0

    return {
      lics, disputadas, ganhas, perdidas, naoParticipamos, aguardando,
      motivos: Object.entries(motivos).sort((a, b) => b[1] - a[1]),
      taxa,
      faturamento: empenhos.reduce((s, e) => s + e.faturamento, 0),
      receita: empenhos.reduce((s, e) => s + e.receita, 0),
      empenhos,
      certVencendo: dados.certidoes.filter(c => c.empresa_id === empresaSel && (c.status === 'bad' || c.status === 'warn')),
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

          <h2 className="rel-h2">1. Resumo executivo</h2>
          <div className="rel-kpis">
            <div><strong>{rel.lics.length}</strong><span>oportunidades analisadas</span></div>
            <div><strong>{rel.disputadas.length}</strong><span>processos disputados</span></div>
            <div><strong>{rel.ganhas.length}</strong><span>vitórias</span></div>
            <div><strong>{rel.taxa.toFixed(0)}%</strong><span>taxa de sucesso</span></div>
          </div>

          <p className="rel-texto">
            No período de referência foram identificadas e analisadas <strong>{rel.lics.length} oportunidades</strong> aderentes
            ao perfil da {empresa?.nome}. Dessas, participamos de <strong>{rel.disputadas.length} processo{rel.disputadas.length !== 1 ? 's' : ''}</strong>
            {rel.ganhas.length > 0
              ? <>, com <strong>{rel.ganhas.length} vitória{rel.ganhas.length !== 1 ? 's' : ''}</strong>.</>
              : rel.disputadas.length > 0 ? <>, sem vitórias no período.</> : <>.</>}
            {rel.naoParticipamos.length > 0 && <> As demais <strong>{rel.naoParticipamos.length}</strong> não foram disputadas por motivos técnicos e comerciais objetivos, detalhados abaixo.</>}
            {rel.aguardando.length > 0 && <> Há <strong>{rel.aguardando.length}</strong> processo{rel.aguardando.length !== 1 ? 's' : ''} ainda aguardando sessão.</>}
          </p>

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

          {rel.disputadas.length > 0 && (
            <>
              <h2 className="rel-h2">3. Processos disputados</h2>
              {rel.disputadas.map(l => (
                <div className="rel-lic" key={l.id} style={{ borderLeftColor: corResultado(l.resultado) }}>
                  <div className="rel-lic-tit">
                    {l.numeroEdital || 'Sem nº'} — {l.orgao}{l.uf ? '/' + l.uf : ''}
                    <span style={{ color: corResultado(l.resultado) }}>{nomeResultado(l.resultado)}</span>
                  </div>
                  <div className="rel-lic-meta">
                    {l.modalidade}{l.portal ? ' · ' + l.portal : ''}{l.dataAbertura ? ' · sessão em ' + l.dataAbertura.split(' ')[0] : ''}
                    {l.valor ? ' · estimado ' + l.valor : ''}
                  </div>
                  {l.objeto && <div className="rel-lic-obj">{l.objeto}</div>}
                  {(l.nossoLance || l.valorVencedor) && (
                    <div className="rel-lic-disputa">
                      {l.nossoLance && <>Nosso lance: <strong>{brl(l.nossoLance)}</strong></>}
                      {l.valorVencedor && <> · Vencedor: <strong>{brl(l.valorVencedor)}</strong>{l.empresaVencedora ? ' (' + l.empresaVencedora + ')' : ''}</>}
                      {l.colocacao && <> · Nossa colocação: {l.colocacao}º</>}
                    </div>
                  )}
                  {l.motivo && <div className="rel-lic-motivo">Motivo: {l.motivo}</div>}
                  {l.observacaoDisputa && <div className="rel-lic-obs">{l.observacaoDisputa}</div>}
                </div>
              ))}
            </>
          )}

          {rel.naoParticipamos.length > 0 && (
            <>
              <h2 className="rel-h2">4. Oportunidades analisadas e não disputadas</h2>
              <table className="rel-tabela">
                <thead><tr><th>Motivo</th><th style={{ textAlign: 'right' }}>Quantidade</th></tr></thead>
                <tbody>
                  {rel.motivos.map(([m, q]) => (
                    <tr key={m}><td>{m}</td><td style={{ textAlign: 'right' }}>{q}</td></tr>
                  ))}
                </tbody>
              </table>
              <table className="rel-tabela" style={{ marginTop: 10 }}>
                <thead><tr><th>Edital</th><th>Órgão</th><th>UF</th><th style={{ textAlign: 'right' }}>Estimado</th><th>Motivo</th></tr></thead>
                <tbody>
                  {rel.naoParticipamos.map(l => (
                    <tr key={l.id}>
                      <td>{l.numeroEdital || '—'}</td>
                      <td style={{ maxWidth: 220 }}>{l.orgao}</td>
                      <td>{l.uf}</td>
                      <td style={{ textAlign: 'right' }}>{l.valor || '—'}</td>
                      <td>{l.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {rel.aguardando.length > 0 && (
            <>
              <h2 className="rel-h2">5. Em andamento</h2>
              <table className="rel-tabela">
                <thead><tr><th>Edital</th><th>Órgão</th><th>Sessão</th><th style={{ textAlign: 'right' }}>Estimado</th></tr></thead>
                <tbody>
                  {rel.aguardando.map(l => (
                    <tr key={l.id}>
                      <td>{l.numeroEdital || '—'}</td>
                      <td style={{ maxWidth: 260 }}>{l.orgao}</td>
                      <td>{(l.dataAbertura || '').split(' ')[0] || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{l.valor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {rel.certVencendo.length > 0 && (
            <>
              <h2 className="rel-h2">6. Documentação — atenção</h2>
              <p className="rel-texto">Os documentos abaixo exigem renovação para não comprometer a habilitação nas próximas disputas:</p>
              <table className="rel-tabela">
                <thead><tr><th>Documento</th><th>Validade</th><th>Situação</th></tr></thead>
                <tbody>
                  {rel.certVencendo.map(c => (
                    <tr key={c.id}>
                      <td>{c.tipo}</td><td>{c.validade || '—'}</td>
                      <td style={{ color: c.status === 'bad' ? '#DC2626' : '#D97706', fontWeight: 700 }}>
                        {c.status === 'bad' ? 'Vencida' : 'Vence em ' + c.dias + ' dias'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {rel.lics.length === 0 && rel.empenhos.length === 0 && (
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
