'use client'
import { useEffect, useState } from 'react'
import { gerarResumoTexto } from '@/lib/checklist'

const moeda = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Pedido de cotação por e-mail: gera um link público (sem login) para o
// fornecedor preencher o preço dele. O que ele responde fica como "cotação
// recebida" — só entra no Valor mínimo quando você clica em "usar".
export default function PainelCotacao({ lic, itens, setItens, marcados }) {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(false)
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [linkGerado, setLinkGerado] = useState('')
  const [copiado, setCopiado] = useState(null)

  let chkDados = {}
  try { chkDados = JSON.parse(lic.checklistJson || '{}') } catch {}
  const resumoTexto = gerarResumoTexto(chkDados)
  const [incluirEdital, setIncluirEdital] = useState(true)
  const [incluirResumo, setIncluirResumo] = useState(true)

  function carregar() {
    fetch(`/api/licitacoes/cotacao?licitacaoId=${lic.id}`).then(r => r.json())
      .then(r => { if (r.sucesso) setLista(r.cotacoes) })
      .catch(() => {})
  }
  useEffect(() => { carregar() }, [lic.id])

  async function enviarPedido() {
    if (!email.trim()) { setErro('Informe o e-mail do fornecedor.'); return }
    if (!marcados.length) { setErro('Marque ao menos um item para participar antes de pedir cotação.'); return }
    setErro(''); setEnviando(true); setLinkGerado('')
    try {
      const r = await fetch('/api/licitacoes/cotacao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licitacaoId: lic.id, empresaId: lic.empresa_id, numeroEdital: lic.numeroEdital, objeto: lic.objeto,
          itens: marcados.map(it => ({ descricao: it.descricao, quantidade: it.quantidade, unidade: it.unidade })),
          destinatarioEmail: email.trim(), mensagem,
          editalAnexoUrl: (incluirEdital && lic.anexoDriveUrl) ? lic.anexoDriveUrl : '',
          resumoTexto: (incluirResumo && resumoTexto) ? resumoTexto : '',
          linkLicitacao: lic.link || '', dataSessao: lic.dataSessao || lic.dataLimite || lic.dataAbertura || '', srp: lic.srp || '',
        }),
      }).then(x => x.json())
      if (r.sucesso) {
        setLinkGerado(r.link)
        if (r.avisoEmail) setErro('Pedido salvo, mas: ' + r.avisoEmail + ' — copie o link acima e envie manualmente.')
        setEmail(''); setMensagem('')
        carregar()
      } else setErro(r.erro || 'Erro ao criar pedido.')
    } catch { setErro('Erro de conexão.') }
    setEnviando(false)
  }

  function usarPrecos(cotacao) {
    if (!confirm('Usar os preços recebidos como Valor mínimo dos itens correspondentes? Isso substitui o valor atual desses itens.')) return
    setItens(atual => atual.map(it => {
      const resp = cotacao.respostaItens.find(r => r.descricao === it.descricao)
      if (!resp || !resp.precoFornecedor) return it
      return { ...it, meuValor: resp.precoFornecedor, formaValor: 'unitario' }
    }))
  }

  async function excluirPedido(cotacao) {
    if (!confirm(`Excluir o pedido de cotação enviado para ${cotacao.destinatarioEmail}? Essa ação não pode ser desfeita.`)) return
    try {
      const r = await fetch(`/api/licitacoes/cotacao?id=${cotacao.id}`, { method: 'DELETE' }).then(x => x.json())
      if (r.sucesso) carregar()
      else setErro(r.erro || 'Erro ao excluir.')
    } catch { setErro('Erro de conexão.') }
  }

  return (
    <div className="form-sub" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ margin: 0 }}>📨 PEDIDO DE COTAÇÃO {lista?.length > 0 && <span style={{ fontWeight: 400, color: '#94A3B8' }}>({lista.length})</span>}</label>
        <button className="iBtn" onClick={() => setAberto(a => !a)}>{aberto ? 'Fechar' : '+ Novo pedido'}</button>
      </div>

      {lista && lista.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {lista.map(c => {
            const link = typeof window !== 'undefined' ? `${window.location.origin}/cotacao/${c.token}` : ''
            return (
              <div className="cotacao-item" key={c.id}>
                <div className="cotacao-item-hdr">
                  <span><strong>{c.destinatarioEmail}</strong> · {c.itens.length} item{c.itens.length > 1 ? 's' : ''}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className={'pill ' + (c.status === 'Respondida' ? 'pill-green' : 'pill-amber')}>{c.status}</span>
                    <button className="iBtn iBtn-del" title="Excluir este pedido" onClick={() => excluirPedido(c)}>🗑</button>
                  </span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input readOnly value={link} onClick={e => e.target.select()}
                    style={{ flex: 1, minWidth: 180, padding: '5px 8px', fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 7, color: '#64748B' }} />
                  <button className="iBtn" onClick={() => {
                    navigator.clipboard.writeText(link); setCopiado(c.id)
                    setTimeout(() => setCopiado(null), 2000)
                  }}>
                    {copiado === c.id ? '✓ copiado' : '📋 copiar link'}
                  </button>
                </div>
                {c.status === 'Respondida' && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: '#64748B' }}>
                      {c.respostaItens.filter(r => r.precoFornecedor).length} preço(s) recebido(s)
                      {c.numeroCotacaoFornecedor && ' · nº ' + c.numeroCotacaoFornecedor}
                    </span>
                    {c.anexoDriveUrl && <a href={c.anexoDriveUrl} target="_blank" rel="noreferrer" className="iBtn">📎 anexo</a>}
                    <button className="iBtn iBtn-up" onClick={() => usarPrecos(c)}>usar estes preços</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {aberto && (
        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 10 }}>
          <p className="dica-menus" style={{ marginTop: 0 }}>
            Envia um link público (sem senha) para o fornecedor preencher o preço só dos {marcados.length} item(ns) marcados acima.
          </p>
          <div className="form-sub" style={{ marginTop: 8 }}>
            <label>E-MAIL DO FORNECEDOR</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="compras@fornecedor.com.br" />
          </div>
          <div className="form-sub">
            <label>MENSAGEM (OPCIONAL)</label>
            <textarea rows={2} value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Preciso do menor preço até amanhã, prazo apertado..." />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#374151', cursor: lic.anexoDriveUrl ? 'pointer' : 'not-allowed' }}>
              <input type="checkbox" checked={incluirEdital && !!lic.anexoDriveUrl} disabled={!lic.anexoDriveUrl}
                onChange={e => setIncluirEdital(e.target.checked)} />
              📎 Incluir o edital anexado{!lic.anexoDriveUrl && ' (nenhum edital anexado ainda — anexe na fase Em análise)'}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#374151', cursor: resumoTexto ? 'pointer' : 'not-allowed' }}>
              <input type="checkbox" checked={incluirResumo && !!resumoTexto} disabled={!resumoTexto}
                onChange={e => setIncluirResumo(e.target.checked)} />
              📄 Incluir o resumo da análise{!resumoTexto && ' (nenhuma análise registrada ainda — preencha o checklist em Em análise)'}
            </label>
          </div>
          {linkGerado && (
            <div className="l-ok" style={{ marginBottom: 10, wordBreak: 'break-all' }}>
              Link gerado: {linkGerado}
            </div>
          )}
          {erro && <div className="l-err" style={{ marginBottom: 10 }}>{erro}</div>}
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={enviarPedido} disabled={enviando}>
            {enviando ? 'Enviando...' : '📨 Enviar pedido de cotação'}
          </button>
        </div>
      )}
    </div>
  )
}
