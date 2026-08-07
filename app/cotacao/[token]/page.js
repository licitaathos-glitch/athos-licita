'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function CotacaoPublicaPage() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [precos, setPrecos] = useState([])
  const [numeroCotacao, setNumeroCotacao] = useState('')
  const [respondidoPor, setRespondidoPor] = useState('')
  const [anexo, setAnexo] = useState(null)
  const [anexoNome, setAnexoNome] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    fetch(`/api/cotacao/${token}`).then(r => r.json()).then(r => {
      if (r.sucesso) {
        setDados(r.cotacao)
        setPrecos(r.cotacao.itens.map(it => {
          const existente = r.cotacao.respostaItens.find(x => x.descricao === it.descricao)
          return { descricao: it.descricao, quantidade: it.quantidade, unidade: it.unidade, precoFornecedor: existente?.precoFornecedor || '' }
        }))
        setNumeroCotacao(r.cotacao.numeroCotacaoFornecedor || '')
        if (r.cotacao.status === 'Respondida') setEnviado(true)
      } else setErro(r.erro || 'Link inválido.')
    }).catch(() => setErro('Erro de conexão.'))
  }, [token])

  function setPreco(i, v) {
    setPrecos(a => a.map((p, j) => j === i ? { ...p, precoFornecedor: v } : p))
  }

  async function onArquivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result).split(',')[1])
      r.onerror = rej
      r.readAsDataURL(file)
    })
    setAnexo({ base64, mimeType: file.type || 'application/pdf', nomeArquivo: file.name })
    setAnexoNome(file.name)
  }

  async function enviar() {
    const semPreco = precos.filter(p => !String(p.precoFornecedor).trim())
    if (semPreco.length === precos.length) { setErro('Informe ao menos um preço.'); return }
    setErro(''); setEnviando(true)
    try {
      const r = await fetch(`/api/cotacao/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precos, numeroCotacaoFornecedor: numeroCotacao, respondidoPor,
          ...(anexo || {}),
        }),
      }).then(x => x.json())
      if (r.sucesso) setEnviado(true)
      else setErro(r.erro || 'Erro ao enviar.')
    } catch { setErro('Erro de conexão.') }
    setEnviando(false)
  }

  if (erro && !dados) {
    return (
      <div className="cot-wrap">
        <div className="cot-card">
          <img src="/brand/athos-mark.png" alt="" className="cot-logo" />
          <p className="cot-erro">{erro}</p>
        </div>
      </div>
    )
  }
  if (!dados) return <div className="cot-wrap"><div className="cot-card">Carregando...</div></div>

  if (enviado) {
    return (
      <div className="cot-wrap">
        <div className="cot-card">
          <img src="/brand/athos-mark.png" alt="" className="cot-logo" />
          <h1>Cotação recebida ✅</h1>
          <p>Obrigado! Já recebemos os valores para <strong>{dados.numeroEdital}</strong>. Se precisar alterar algo, é só voltar neste mesmo link.</p>
          <button className="cot-btn-ghost" onClick={() => setEnviado(false)}>Alterar minha resposta</button>
        </div>
      </div>
    )
  }

  return (
    <div className="cot-wrap">
      <div className="cot-card">
        <img src="/brand/athos-mark.png" alt="" className="cot-logo" />
        <h1>Pedido de cotação</h1>
        <p className="cot-sub">
          {dados.empresaNome} está participando de <strong>{dados.numeroEdital}</strong> e precisa do seu melhor preço.
        </p>
        {dados.objeto && <p className="cot-objeto">{dados.objeto}</p>}
        {dados.mensagem && <div className="cot-msg">{dados.mensagem}</div>}
        {dados.resumoTexto && (
          <div className="cot-msg" style={{ whiteSpace: 'pre-wrap' }}>
            <strong>Resumo do edital:</strong><br />{dados.resumoTexto}
          </div>
        )}
        {dados.editalAnexoUrl && (
          <p style={{ margin: '0 0 16px' }}>
            <a href={dados.editalAnexoUrl} target="_blank" rel="noreferrer" className="cot-btn-ghost" style={{ display: 'inline-block', textDecoration: 'none' }}>
              📎 Baixar edital completo
            </a>
          </p>
        )}

        <table className="cot-tbl">
          <thead><tr><th>Descrição</th><th>Qtd</th><th>Un</th><th>Seu preço (R$)</th></tr></thead>
          <tbody>
            {precos.map((p, i) => (
              <tr key={i}>
                <td>{p.descricao}</td>
                <td>{p.quantidade}</td>
                <td>{p.unidade}</td>
                <td><input type="number" step="0.01" value={p.precoFornecedor}
                  onChange={e => setPreco(i, e.target.value)} placeholder="0,00" /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cot-campo">
          <label>Nº DA SUA COTAÇÃO/ORÇAMENTO (opcional)</label>
          <input value={numeroCotacao} onChange={e => setNumeroCotacao(e.target.value)} />
        </div>
        <div className="cot-campo">
          <label>SEU NOME (opcional)</label>
          <input value={respondidoPor} onChange={e => setRespondidoPor(e.target.value)} />
        </div>
        <div className="cot-campo">
          <label>ANEXAR ORÇAMENTO EM PDF (opcional)</label>
          <label className="cot-upload">
            <input type="file" accept=".pdf,image/*" onChange={onArquivo} style={{ display: 'none' }} />
            {anexoNome ? '✅ ' + anexoNome : '📄 Clique para anexar'}
          </label>
        </div>

        {erro && <p className="cot-erro">{erro}</p>}

        <button className="cot-btn" onClick={enviar} disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar minha cotação'}
        </button>
      </div>
    </div>
  )
}
