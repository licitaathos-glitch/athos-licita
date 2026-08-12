'use client'
import { useEffect, useState } from 'react'
import { STATUS_EMPENHO, fmtBRL } from '@/lib/comercial'
import { enviarAoGAS, lerBase64 } from '@/lib/gasClient'

const isoParaBR = v => { const p = String(v || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '' }
const brParaISO = v => { const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
const n = v => Number(String(v || '').replace(',', '.')) || 0

// Chave para casar o item da ata com o item cotado pelo fornecedor. As duas
// descrições vêm de origens diferentes (ata x edital), então compara sem
// acento, sem pontuação e sem diferença de maiúscula/espaço.
const chaveItem = txt => String(txt || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export default function ModalEmpenho({ empenho = {}, ata, empresaId, modelo, percentual, itensDisponiveis = [], onFechar, onSalvo }) {
  const ed = !!empenho.id
  const [anexo, setAnexo] = useState({
    id: empenho?.anexoDriveId || '', url: empenho?.anexoDriveUrl || '', nome: empenho?.anexoNome || '',
  })
  const [enviando, setEnviando] = useState(false)
  const [avisoIA, setAvisoIA] = useState('')

  const [f, setF] = useState({
    numeroEmpenho: empenho.numeroEmpenho || '',
    dataEmpenho: brParaISO(empenho.dataEmpenho),
    itemNumero: empenho.itemNumero || '',
    itemDescricao: empenho.itemDescricao || '',
    quantidade: empenho.quantidade || '',
    valorUnitario: empenho.valorUnitario || '',
    custoUnitario: empenho.custoUnitario || '',
    status: empenho.status || 'Empenhado',
    notaFiscal: empenho.notaFiscal || '',
    dataFaturamento: brParaISO(empenho.dataFaturamento),
    dataPagamento: brParaISO(empenho.dataPagamento),
    observacao: empenho.observacao || '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const set = (k, v) => setF(o => ({ ...o, [k]: v }))

  // Custo de compra do item = valor mínimo apurado na cotação do pregão que
  // originou esta ata. Duas fontes, nesta ordem:
  //   1) o Valor mínimo lançado nos itens da licitação (Inscrição de proposta);
  //   2) o menor preço que algum fornecedor respondeu no pedido de cotação.
  // Chave de casamento: descrição do item normalizada.
  const [custosCotacao, setCustosCotacao] = useState(null)
  const licId = ata?.licitacaoId || ''

  useEffect(() => {
    if (!licId) { setCustosCotacao({}); return }
    let vivo = true
    async function carregar() {
      const mapa = {}
      // 1) valor mínimo dos itens da licitação
      try {
        const r = await fetch('/api/licitacoes').then(x => x.json())
        const lic = (r.licitacoes || []).find(l => String(l.id) === String(licId))
        for (const it of lic?.itens || []) {
          const v = n(it.meuValor)
          const k = chaveItem(it.descricao)
          if (!v || !k) continue
          if (mapa[k] === undefined || v < mapa[k]) mapa[k] = v
        }
      } catch {}
      // 2) preços respondidos pelos fornecedores
      try {
        const r = await fetch('/api/licitacoes/cotacao?licitacaoId=' + encodeURIComponent(licId)).then(x => x.json())
        for (const c of r.cotacoes || []) {
          for (const resp of c.respostaItens || []) {
            const preco = n(resp.precoFornecedor)
            const k = chaveItem(resp.descricao)
            if (!preco || !k) continue
            if (mapa[k] === undefined || preco < mapa[k]) mapa[k] = preco
          }
        }
      } catch {}
      if (vivo) setCustosCotacao(mapa)
    }
    carregar()
    return () => { vivo = false }
  }, [licId])

  const custoCotado = desc => {
    const k = chaveItem(desc)
    return custosCotacao && k && custosCotacao[k] !== undefined ? custosCotacao[k] : null
  }

  // Ao escolher o item da ata, puxa descrição, preço registrado e o custo de compra
  function escolherItem(numero) {
    const it = itensDisponiveis.find(x => String(x.item) === String(numero))
    const custo = custoCotado(it?.descricao)
    setF(o => ({
      ...o,
      itemNumero: numero,
      itemDescricao: it?.descricao || o.itemDescricao,
      valorUnitario: it?.valorUnitario ?? o.valorUnitario,
      custoUnitario: custo !== null ? String(custo) : o.custoUnitario,
    }))
  }

  const itemSel = itensDisponiveis.find(x => String(x.item) === String(f.itemNumero))
  const custoDoItem = custoCotado(itemSel?.descricao || f.itemDescricao)

  // A cotação pode chegar depois do item já estar escolhido — preenche o custo
  // se ainda estiver vazio, sem sobrescrever nada que já tenha sido digitado.
  useEffect(() => {
    if (custoDoItem === null) return
    setF(o => (String(o.custoUnitario).trim() ? o : { ...o, custoUnitario: String(custoDoItem) }))
  }, [custoDoItem])
  const faturamento = n(f.quantidade) * n(f.valorUnitario)
  const custo = n(f.quantidade) * n(f.custoUnitario)
  const receita = modelo === 'comissao' ? faturamento * (n(percentual) / 100) : faturamento - custo
  const excedeSaldo = itemSel && n(f.quantidade) > itemSel.saldo + n(empenho.quantidade || 0)

  // Sobe a nota de empenho para o Drive e tenta ler os dados pelo Gemini
  async function onArquivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { setErro('Arquivo acima de 25 MB.'); return }
    setErro(''); setAvisoIA(''); setEnviando(true)
    try {
      const base64 = await lerBase64(file)
      const mimeType = file.type || 'application/pdf'

      const up = await enviarAoGAS({
        action: 'uploadAnexoEdital',
        base64, mimeType, nomeArquivo: file.name,
        empresaNome: ata?.empresa_nome || 'Geral',
      })
      if (up.ok) setAnexo({ id: up.driveFileId, url: up.driveFileUrl, nome: file.name })
      else setErro(up.erro || 'Falha ao salvar no Drive.')

      // Leitura automática — depende da ação estar publicada no Apps Script
      const ia = await enviarAoGAS({ action: 'extrairDadosEmpenho', base64, mimeType })
      if (ia && ia.sucesso && ia.dados) {
        const d = ia.dados
        setF(o => ({
          ...o,
          numeroEmpenho: d.numeroEmpenho || o.numeroEmpenho,
          dataEmpenho: brParaISO(d.dataEmpenho) || o.dataEmpenho,
          quantidade: d.quantidade ?? o.quantidade,
          valorUnitario: d.valorUnitario ?? o.valorUnitario,
          itemDescricao: d.itemDescricao || o.itemDescricao,
          itemNumero: d.itemNumero || o.itemNumero,
          observacao: d.observacao || o.observacao,
        }))
        setAvisoIA('Dados lidos da nota de empenho — confira antes de salvar.')
      } else if (ia && ia.erro) {
        setAvisoIA('Arquivo salvo. A leitura automática não está disponível (' + ia.erro + ').')
      }
    } catch (ex) {
      setErro(ex.message || 'Erro ao enviar o arquivo.')
    }
    setEnviando(false)
    e.target.value = ''
  }

  async function salvar() {
    if (!f.numeroEmpenho.trim()) { setErro('Informe o número da nota de empenho.'); return }
    if (!n(f.quantidade)) { setErro('Informe a quantidade empenhada.'); return }
    setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/empenhos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: empenho.id || null,
          empresa_id: empresaId,
          ataId: ata?.id || empenho.ataId || '',
          numeroAta: ata?.numeroAta || empenho.numeroAta || '',
          orgao: ata?.orgao || empenho.orgao || '',
          anexoDriveId: anexo.id, anexoDriveUrl: anexo.url, anexoNome: anexo.nome,
          ...f,
          dataEmpenho: isoParaBR(f.dataEmpenho),
          dataFaturamento: isoParaBR(f.dataFaturamento),
          dataPagamento: isoParaBR(f.dataPagamento),
        }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo(); else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">PEDIDO / NOTA DE EMPENHO</div>
            <div className="modal-hdr-title">{ed ? 'Editar empenho' : 'Novo empenho'}</div>
            {ata?.numeroAta && <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>Ata {ata.numeroAta} · {ata.orgao}</div>}
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-sub">
            <label>📎 ARQUIVO DA NOTA DE EMPENHO</label>
            {anexo.url && (
              <div className="anexo-item">
                <a href={anexo.url} target="_blank" rel="noreferrer">📄 {anexo.nome || 'Nota de empenho'}</a>
                <button className="iBtn iBtn-del" onClick={() => setAnexo({ id: '', url: '', nome: '' })}>×</button>
              </div>
            )}
            <label className={'uz' + (enviando ? ' uploading' : anexo.url ? ' success' : '')} style={{ padding: 16 }}>
              <input type="file" accept=".pdf,image/*" onChange={onArquivo} disabled={enviando} style={{ display: 'none' }} />
              {enviando
                ? '🤖 Salvando no Drive e lendo a nota... (pode levar até 40s)'
                : anexo.url ? '➕ Trocar arquivo' : '📄 Clique para anexar a nota de empenho (até 25 MB)'}
            </label>
            {avisoIA && <p className="dica-menus">{avisoIA}</p>}
          </div>

          <div className="form-grid">
            <div><label className="mini-lbl">Nº DA NOTA DE EMPENHO *</label>
              <input value={f.numeroEmpenho} onChange={e => set('numeroEmpenho', e.target.value)} placeholder="2026NE000123" /></div>
            <div><label className="mini-lbl">DATA DO EMPENHO</label>
              <input type="date" value={f.dataEmpenho} onChange={e => set('dataEmpenho', e.target.value)} /></div>
          </div>

          {itensDisponiveis.length > 0 && (
            <div className="form-sub">
              <label>ITEM DA ATA</label>
              <select value={f.itemNumero} onChange={e => escolherItem(e.target.value)}>
                <option value="">Selecione o item</option>
                {itensDisponiveis.map(it => (
                  <option key={it.item} value={it.item}>
                    Item {it.item} — {String(it.descricao).slice(0, 60)} (saldo {it.saldo})
                  </option>
                ))}
              </select>
              {itemSel && (
                <div className="saldo-info">
                  Registrado <strong>{itemSel.registrado}</strong> · Empenhado <strong>{itemSel.empenhado}</strong> · Saldo <strong style={{ color: itemSel.saldo > 0 ? '#16A34A' : '#DC2626' }}>{itemSel.saldo}</strong>
                </div>
              )}
            </div>
          )}

          {!itensDisponiveis.length && (
            <div className="form-sub"><label>DESCRIÇÃO DO ITEM</label>
              <input value={f.itemDescricao} onChange={e => set('itemDescricao', e.target.value)} /></div>
          )}

          <div className="form-grid">
            <div><label className="mini-lbl">QUANTIDADE *</label>
              <input type="number" value={f.quantidade} onChange={e => set('quantidade', e.target.value)} /></div>
            <div><label className="mini-lbl">VALOR UNITÁRIO (venda)</label>
              <input type="number" step="0.01" value={f.valorUnitario} onChange={e => set('valorUnitario', e.target.value)} /></div>
            {modelo !== 'comissao' && (
              <div><label className="mini-lbl">CUSTO UNITÁRIO (compra)</label>
                <input type="number" step="0.01" value={f.custoUnitario} onChange={e => set('custoUnitario', e.target.value)} />
                {custoDoItem !== null ? (
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    Valor mínimo da cotação: {fmtBRL(custoDoItem)}
                    {n(f.custoUnitario) !== custoDoItem && (
                      <button type="button" className="iBtn" style={{ marginLeft: 6 }}
                        onClick={() => set('custoUnitario', String(custoDoItem))}>usar</button>
                    )}
                  </div>
                ) : f.itemNumero && custosCotacao && (
                  <div style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>
                    {!licId
                      ? 'Ata sem pregão vinculado — edite a ata e preencha "Vincular a um pregão vencido" para o custo vir sozinho.'
                      : 'Não achei o valor mínimo deste item no pregão vinculado (a descrição na ata pode estar diferente da do edital).'}
                  </div>
                )}</div>
            )}
          </div>

          {excedeSaldo && (
            <div className="aviso-box" style={{ background: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}>
              ⚠️ A quantidade informada ultrapassa o saldo disponível deste item na ata.
            </div>
          )}

          <div className="resumo-fin">
            <div><span>Faturamento</span><strong>{fmtBRL(faturamento)}</strong></div>
            {modelo !== 'comissao' && <div><span>Custo</span><strong>{fmtBRL(custo)}</strong></div>}
            <div className="destaque">
              <span>{modelo === 'comissao' ? `Comissão (${percentual || 0}%)` : 'Margem'}</span>
              <strong>{fmtBRL(receita)}</strong>
            </div>
          </div>

          <div className="form-grid">
            <div><label className="mini-lbl">SITUAÇÃO</label>
              <select value={f.status} onChange={e => set('status', e.target.value)}>
                {STATUS_EMPENHO.map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div><label className="mini-lbl">NOTA FISCAL</label>
              <input value={f.notaFiscal} onChange={e => set('notaFiscal', e.target.value)} /></div>
            <div><label className="mini-lbl">DATA DO FATURAMENTO</label>
              <input type="date" value={f.dataFaturamento} onChange={e => set('dataFaturamento', e.target.value)} /></div>
            <div><label className="mini-lbl">DATA DO PAGAMENTO</label>
              <input type="date" value={f.dataPagamento} onChange={e => set('dataPagamento', e.target.value)} /></div>
          </div>

          <div className="form-sub"><label>OBSERVAÇÃO</label>
            <input value={f.observacao} onChange={e => set('observacao', e.target.value)} /></div>

          {erro && <div className="l-err" style={{ marginTop: 12 }}>{erro}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar empenho'}
          </button>
        </div>
      </div>
    </div>
  )
}
