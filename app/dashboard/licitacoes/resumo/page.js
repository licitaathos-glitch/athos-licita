'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { gerarResumoTexto } from '@/lib/checklist'

const brl = v => (v || v === 0) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null

function ResumoConteudo() {
  const params = useSearchParams()
  const id = params.get('id')
  const [lic, setLic] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!id) return
    fetch('/api/licitacoes').then(r => r.json()).then(r => {
      if (!r.sucesso) { setErro(r.erro || 'Erro ao carregar.'); return }
      const l = r.licitacoes.find(x => x.id === id)
      if (!l) { setErro('Licitação não encontrada.'); return }
      setLic(l)
    }).catch(() => setErro('Erro de conexão.'))
  }, [id])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!id) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Faltou informar a licitação.</div>
  if (!lic) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  let chkDados = {}
  try { chkDados = JSON.parse(lic.checklistJson || '{}') } catch {}
  const resumoTexto = gerarResumoTexto(chkDados)
  const obs = chkDados._obs || ''
  const marcados = (lic.itens || []).filter(it => it.participar)

  return (
    <div>
      <div className="nao-imprimir">
        <h2 className="sec-title">Resumo completo da licitação</h2>
        <p className="sec-sub">{lic.numeroEdital} — {lic.orgao}</p>
        <div className="form-card">
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => window.print()}>
            🖨️ Imprimir / Salvar em PDF
          </button>
          <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 10 }}>
            Na janela de impressão, escolha <strong>Destino: Salvar como PDF</strong> para baixar o arquivo.
          </p>
        </div>
      </div>

      <div className="relatorio">
        <div className="rel-cabecalho">
          <div>
            <div className="rel-marca">⚡ ATHOS LICITA</div>
            <h1>Resumo da Licitação</h1>
            <p>{lic.numeroEdital || 'Sem nº'} — {lic.orgao}{lic.uf ? '/' + lic.uf : ''}</p>
          </div>
          <div className="rel-contato">
            Adriano Ribeiro Bragança<br />
            licita.athos@gmail.com<br />
            (21) 99763-9451
          </div>
        </div>

        <h2 className="rel-h2">Informações básicas</h2>
        <table className="rel-tabela">
          <tbody>
            {[
              ['Órgão', lic.orgao], ['UASG', lic.uasg], ['UF', lic.uf], ['Modalidade', lic.modalidade],
              ['Portal', lic.portal], ['Nº PNCP', lic.numeroPNCP], ['SRP', lic.srp],
              ['Valor estimado', lic.valor], ['Abertura', lic.dataAbertura], ['Limite da proposta', lic.dataLimite],
              ['Sessão de disputa', lic.dataSessao],
            ].filter(x => x[1]).map(x => (
              <tr key={x[0]}><td style={{ fontWeight: 700, width: 200 }}>{x[0]}</td><td>{x[1]}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 className="rel-h2">Objeto</h2>
        <p className="rel-texto">{lic.objeto || '—'}</p>

        {resumoTexto && (
          <>
            <h2 className="rel-h2">Análise de viabilidade</h2>
            <p className="rel-texto" style={{ whiteSpace: 'pre-wrap' }}>{resumoTexto}</p>
          </>
        )}

        {obs && (
          <>
            <h2 className="rel-h2">Observações</h2>
            <p className="rel-texto">{obs}</p>
          </>
        )}

        {marcados.length > 0 && (
          <>
            <h2 className="rel-h2">Itens em que vamos participar</h2>
            <table className="rel-tabela">
              <thead><tr><th>Descrição</th><th>Qtd</th><th>Un</th><th style={{ textAlign: 'right' }}>Vl. estimado</th></tr></thead>
              <tbody>
                {marcados.map((it, i) => (
                  <tr key={i}>
                    <td style={{ maxWidth: 380 }}>{it.descricao}</td>
                    <td>{it.quantidade}</td>
                    <td>{it.unidade}</td>
                    <td style={{ textAlign: 'right' }}>{it.valorUnitarioRef ? brl(it.valorUnitarioRef) : 'Sigiloso'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {lic.link && (
          <>
            <h2 className="rel-h2">Link do edital</h2>
            <p className="rel-texto"><a href={lic.link} target="_blank" rel="noreferrer">{lic.link}</a></p>
          </>
        )}

        <div className="rel-rodape">Athos Licita — Consultoria em Licitações Públicas</div>
      </div>
    </div>
  )
}

export default function ResumoLicitacaoPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>}>
      <ResumoConteudo />
    </Suspense>
  )
}
