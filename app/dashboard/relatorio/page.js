'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { fmtBRL, saldoDoItem } from '@/lib/comercial'
import {
  MESES, brl, calcularRelatorio, fichaDados, resumoPartes, rotuloPeriodo,
  mesPeriodo, FAIXAS, FAIXAS_PADRAO,
} from '@/lib/relatorio'
import EnviarRelatorioEmail from '@/components/EnviarRelatorioEmail'
import FiltrosRelatorio from '@/components/FiltrosRelatorio'
import FichaRelatorio from '@/components/FichaRelatorio'

export default function RelatorioPage() {
  const { empresaAtual, empresas } = useApp()
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [filtros, setFiltros] = useState(() => ({
    mesSel: mesAtual, ...mesPeriodo(mesAtual),
    fases: FAIXAS_PADRAO, incluirAnteriores: true, mostrarFinanceiro: true, mostrarAtas: true,
  }))
  const setF = patch => setFiltros(f => ({ ...f, ...patch }))
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    Promise.all([
      fetch('/api/licitacoes').then(r => r.json()),
      fetch('/api/empenhos').then(r => r.json()),
      fetch(`/api/licitacoes/cotacao?empresaId=${empresaAtual}`).then(r => r.json()).catch(() => null),
      // Atas entram no relatório (todas, inclusive vencidas). Se o usuário não
      // tiver acesso ao módulo de atas, o relatório sai normalmente sem a seção.
      fetch('/api/atas').then(r => r.json()).catch(() => null),
    ]).then(([l, e, c, a]) => {
      if (!l.sucesso) { setErro(l.erro || 'Erro ao carregar.'); return }
      setDados({
        lics: l.licitacoes, empenhos: e.sucesso ? e.empenhos : [],
        cotacoes: c?.sucesso ? c.cotacoes : [], atas: a?.sucesso ? a.atas : [],
      })
    }).catch(() => setErro('Erro de conexão.'))
  }, [empresaAtual])

  useEffect(() => { carregar() }, [carregar])

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresa = empresaSel ? empresas.find(e => String(e.id) === empresaSel) : null

  const rel = useMemo(() => {
    if (!dados || !empresaSel) return null
    return calcularRelatorio({
      lics: dados.lics, empenhos: dados.empenhos, cotacoes: dados.cotacoes, empresaSel,
      de: filtros.de, ate: filtros.ate, fases: filtros.fases, incluirAnteriores: filtros.incluirAnteriores,
    })
  }, [dados, empresaSel, filtros.de, filtros.ate, filtros.fases, filtros.incluirAnteriores])

  // Atas da empresa: vigentes primeiro (as que vencem antes no topo), depois
  // as vencidas (a mais recente primeiro) e por fim as sem data de vencimento
  const atasEmpresa = useMemo(() => {
    if (!dados || !empresaSel) return []
    const lista = (dados.atas || []).filter(a => String(a.empresa_id) === empresaSel)
    const grupo = a => a.dias === null || a.dias === undefined ? 2 : a.dias < 0 ? 1 : 0
    return lista.map(a => {
      const empDaAta = dados.empenhos.filter(e => e.ataId === a.id)
      const itens = (a.itens || []).map(it => {
        const sd = saldoDoItem(it, empDaAta)
        const vu = Number(it.valorUnitario) || 0
        return { ...it, ...sd, vu, saldoValor: sd.saldo * vu }
      })
      return {
        ...a, itensCalc: itens,
        saldoValor: itens.reduce((s, it) => s + Math.max(it.saldoValor, 0), 0),
      }
    }).sort((x, y) => {
      const gx = grupo(x), gy = grupo(y)
      if (gx !== gy) return gx - gy
      if (gx === 0) return x.dias - y.dias
      if (gx === 1) return y.dias - x.dias
      return 0
    })
  }, [dados, empresaSel])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const rotulo = rotuloPeriodo(filtros.de, filtros.ate)
  const fasesRotulo = filtros.fases.length === FAIXAS.length
    ? 'todas as fases'
    : FAIXAS.filter(f => filtros.fases.includes(f.id)).map(f => f.nome).join(', ') || 'nenhuma fase'

  const opcoesMes = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    opcoesMes.push({
      v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      l: `${MESES[d.getMonth()]}/${d.getFullYear()}`,
    })
  }

  // Numeração das seções conforme o que está ligado
  const temFin = filtros.mostrarFinanceiro && rel && (rel.faturamento > 0 || rel.receita > 0)
  const temAtas = filtros.mostrarAtas && atasEmpresa.length > 0
  let _n = 1
  const nFin = temFin ? ++_n : 0
  const nLic = ++_n
  const nAtas = temAtas ? ++_n : 0

  return (
    <div>
      <div className="nao-imprimir">
        <h2 className="sec-title">Relatório de licitações</h2>
        <p className="sec-sub">Escolha o período e as fases; o relatório abaixo é o que vai para o PDF e para o e-mail</p>

        <FiltrosRelatorio filtros={filtros} setF={setF} opcoesMes={opcoesMes} />

        <div className="form-card" style={{ marginTop: 12 }}>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => window.print()} disabled={!rel}>
            🖨️ Imprimir / Salvar em PDF
          </button>
          {rel && empresaSel && (
            <EnviarRelatorioEmail empresaId={empresaSel} empresa={empresa} filtros={filtros} />
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
              <p>{empresa?.nome} · {rotulo}</p>
            </div>
            <div className="rel-contato">
              Adriano Ribeiro Bragança<br />
              licitacoes@athoslicita.com<br />
              (21) 99763-9451
            </div>
          </div>

          <h2 className="rel-h2">1. Resumo do período</h2>
          <p className="rel-fases-incluidas">Fases incluídas: {fasesRotulo}</p>
          <p className="rel-texto">
            {resumoPartes(rel).map((p, i) => p.negrito ? <strong key={i}>{p.texto}</strong> : <span key={i}>{p.texto}</span>)}
          </p>
          <div className="rel-kpis">
            <div><strong>{rel.disputadas.length}</strong><span>participadas</span></div>
            <div><strong>{rel.ganhas.length}</strong><span>vencidas</span></div>
            <div><strong>{rel.perdidas.length}</strong><span>perdidas</span></div>
            <div><strong>{rel.emAndamento.length}</strong><span>em andamento</span></div>
          </div>

          {temFin && (
            <>
              <h2 className="rel-h2">{nFin}. Resultado financeiro do período</h2>
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

          <h2 className="rel-h2">{nLic}. Licitações por fase</h2>
          {rel.grupos.length === 0 && (
            <p className="rel-texto">Nenhuma licitação de {empresa?.nome} nas fases e no período selecionados.</p>
          )}
          {rel.grupos.map(g => (
            <div key={g.faixa.id}>
              <div className="rel-grupo" style={{ background: g.faixa.cor + '1A', color: g.faixa.cor }}>
                {g.faixa.nome.toUpperCase()}
                <span>{g.licitacoes.length} {g.licitacoes.length === 1 ? 'licitação' : 'licitações'}</span>
              </div>
              {g.licitacoes.map(l => (
                <FichaRelatorio
                  key={l.id} cor={g.faixa.cor} faseNome={g.faixa.nome}
                  f={fichaDados(l, { cotNums: rel.cotacoesPorLic.get(l.id) || [], faixaId: g.faixa.id })}
                />
              ))}
            </div>
          ))}

          {temAtas && (
            <>
              <h2 className="rel-h2">{nAtas}. Atas de registro de preços e contratos</h2>
              <div className="rel-kpis">
                <div><strong>{atasEmpresa.length}</strong><span>atas/contratos</span></div>
                <div><strong>{atasEmpresa.filter(a => a.dias !== null && a.dias >= 0).length}</strong><span>vigentes</span></div>
                <div><strong>{fmtBRL(atasEmpresa.reduce((s, a) => s + (Number(a.valorTotal) || 0), 0))}</strong><span>valor registrado</span></div>
                <div><strong>{fmtBRL(atasEmpresa.reduce((s, a) => s + a.saldoValor, 0))}</strong><span>saldo a empenhar</span></div>
              </div>
              {atasEmpresa.map(a => {
                const vencida = a.dias !== null && a.dias < 0
                const venceLogo = !vencida && a.dias !== null && a.dias <= 60
                const corSit = vencida ? '#DC2626' : venceLogo ? '#D97706' : '#16A34A'
                const sit = a.dias === null ? 'Sem vencimento informado'
                  : vencida ? 'Vencida'
                  : venceLogo ? `Vence em ${a.dias} dia${a.dias === 1 ? '' : 's'}`
                  : 'Vigente'
                return (
                  <div className="rel-lic rel-ata" key={a.id} style={{ borderLeftColor: corSit }}>
                    <div className="rel-lic-tit">
                      {a.tipoDocumento === 'Contrato' ? 'Contrato' : 'Ata'} {a.numeroAta || 's/nº'} — {a.orgao || 'Órgão não informado'}{a.uf ? '/' + a.uf : ''}
                      <span style={{ color: corSit }}>{sit}</span>
                    </div>
                    <div className="rel-lic-meta">
                      {a.cnpjOrgao ? 'CNPJ ' + a.cnpjOrgao : ''}
                      {a.licitacao ? (a.cnpjOrgao ? ' · ' : '') + 'Licitação ' + a.licitacao : ''}
                      {a.processo ? ' · Processo ' + a.processo : ''}
                      {a.vigencia ? ' · Vigência ' + a.vigencia : ''}
                      {a.vencimento ? ' · Vencimento ' + a.vencimento : ''}
                    </div>
                    <div className="rel-ata-contato">
                      <strong>Contato do órgão:</strong>{' '}
                      {[a.contato, a.telefoneOrgao, a.emailOrgao].filter(Boolean).join(' · ') || <span style={{ color: '#94A3B8' }}>não informado</span>}
                    </div>
                    {a.objeto && <div className="rel-lic-obs">{a.objeto}</div>}
                    {a.itensCalc.length > 0 ? (
                      <table className="rel-tabela" style={{ marginTop: 6 }}>
                        <thead>
                          <tr>
                            <th>Item</th><th>Descrição</th><th>Un</th>
                            <th style={{ textAlign: 'right' }}>Qtd. registrada</th>
                            <th style={{ textAlign: 'right' }}>Vl. unit.</th>
                            <th style={{ textAlign: 'right' }}>Qtd. empenhada</th>
                            <th style={{ textAlign: 'right' }}>Saldo (qtd.)</th>
                            <th style={{ textAlign: 'right' }}>Saldo (R$)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.itensCalc.map((it, i) => (
                            <tr key={i}>
                              <td>{it.item || '—'}</td>
                              <td style={{ maxWidth: 280 }}>{it.descricao}{it.marca ? <div style={{ color: '#64748B' }}>Marca: {it.marca}</div> : null}</td>
                              <td>{it.unidade || '—'}</td>
                              <td style={{ textAlign: 'right' }}>{it.registrado.toLocaleString('pt-BR')}</td>
                              <td style={{ textAlign: 'right' }}>{it.vu ? brl(it.vu) : '—'}</td>
                              <td style={{ textAlign: 'right' }}>{it.empenhado.toLocaleString('pt-BR')}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: it.saldo > 0 ? '#16A34A' : '#DC2626' }}>{it.saldo.toLocaleString('pt-BR')}</td>
                              <td style={{ textAlign: 'right' }}>{it.vu ? fmtBRL(Math.max(it.saldoValor, 0)) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="rel-lic-disputa"><span style={{ color: '#94A3B8' }}>Sem itens cadastrados nesta ata.</span></div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          <div className="rel-rodape">
            Athos Licita · Consultoria em Licitações Públicas · Lei 14.133/2021<br />
            licitacoes@athoslicita.com · (21) 99763-9451 · @athoslicita
          </div>
        </div>
      )}
    </div>
  )
}
