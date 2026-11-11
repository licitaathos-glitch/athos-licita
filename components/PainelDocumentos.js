'use client'
import { useEffect, useMemo, useState } from 'react'
import { enviarAoGAS } from '@/lib/gasClient'

// Proposta (só dos itens vencidos) e declarações exigidas no edital, prontas
// em Word para revisar e assinar. Dois passos, para a parte lenta da IA não
// acontecer na hora da pressa da habilitação:
//  1. a IA lê o edital anexado uma vez e guarda os modelos na licitação;
//  2. com os lances lançados, os documentos saem na hora, sem IA.

const parse = txt => { try { const o = JSON.parse(txt || ''); return o && typeof o === 'object' ? o : null } catch { return null } }
const moeda = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ROTULO_EXTRA = { marca: 'Marca', modelo: 'Modelo', fabricante: 'Fabricante' }

export default function PainelDocumentos({ lic, itens, setItem, resultadoGeral, onAtualizado }) {
  const [modelos, setModelos] = useState(() => parse(lic.modelosDocsJson))
  const [lendo, setLendo] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [aviso, setAviso] = useState('')
  const [gerando, setGerando] = useState('')
  const [empresa, setEmpresa] = useState(null)
  const [escolhidas, setEscolhidas] = useState(() => (parse(lic.modelosDocsJson)?.declaracoes || []).map((_, i) => i))
  const [lib, setLib] = useState(null)

  // A biblioteca de geração (com o docx) só carrega quando este painel abre
  useEffect(() => { import('@/lib/documentosLicitacao').then(setLib).catch(() => {}) }, [])

  useEffect(() => {
    fetch('/api/empresas').then(r => r.json()).then(r => {
      if (r.sucesso) setEmpresa(r.empresas?.find(e => String(e.id) === String(lic.empresa_id)) || {})
    }).catch(() => setEmpresa({}))
  }, [lic.empresa_id])

  // Sem itens cadastrados (licitação de item único preenchida só no total),
  // a proposta sai com uma linha: o objeto, pelo nosso lance
  const vencidos = useMemo(() => {
    if (!lib) return []
    if (itens.length) return lib.itensVencidos(itens, resultadoGeral)
    if (resultadoGeral === 'Ganhamos' || String(lic.colocacao) === '1') {
      return [{ numero: 1, descricao: lic.objeto, quantidade: 1, unidade: 'UN', participar: true,
        lanceFinal: lic.nossoLance, _indice: -1 }]
    }
    return []
  }, [lib, itens, resultadoGeral, lic.objeto, lic.nossoLance, lic.colocacao])

  const total = vencidos.reduce((s, it) => s + (Number(it.lanceFinal || it.meuValor) || 0) * (Number(it.quantidade) || 0), 0)
  const semPreco = vencidos.filter(it => !(Number(it.lanceFinal || it.meuValor) > 0)).length

  // Colunas que pedem dado nosso que o sistema não tem (marca, modelo...)
  const colunasExtras = (modelos?.proposta?.colunas || [])
    .map(c => c.campo).filter(c => ROTULO_EXTRA[c])
  const extrasFaltando = vencidos.filter(it => it._indice >= 0 &&
    colunasExtras.some(c => !String(it[c] || '').trim())).length

  const faltam = (lib && modelos && empresa)
    ? lib.camposFaltando(modelos, lib.montarValores({ empresa, lic }), escolhidas) : []

  // Uma chamada por parte: tudo junto estourava o tempo/memória do Apps
  // Script em editais grandes. A segunda reaproveita os PDFs já enviados.
  async function lerParte(parte) {
    try {
      return await enviarAoGAS({ action: 'extrairModelosDocumentos', licitacaoId: lic.id, empresaId: lic.empresa_id, parte })
    } catch (e) {
      // "NetworkError"/"Failed to fetch": o Google devolveu página de erro em
      // vez de resposta — quase sempre o Apps Script passou do tempo
      const rede = /network|failed to fetch|load failed/i.test(e.message || '')
      return { sucesso: false, erro: rede
        ? 'o Apps Script parou antes de responder (edital muito grande ou demorado). Tente de novo — a segunda tentativa costuma ser mais rápida.'
        : e.message }
    }
  }

  async function lerEdital() {
    setLendo(true); setAviso('')
    const anterior = modelos || {}
    setProgresso('1/2 · lendo o modelo de proposta...')
    const rp = await lerParte('proposta')
    setProgresso('2/2 · lendo as declarações...')
    const rd = await lerParte('declaracoes')
    setProgresso('')

    if (!rp?.sucesso && !rd?.sucesso) {
      setAviso('❌ Não consegui ler o edital: ' + (rd?.erro || rp?.erro || 'sem resposta'))
      setLendo(false); return
    }
    // Parte que falhou mantém o que já havia sido lido antes (se havia)
    const m = {
      proposta: rp?.sucesso ? (rp.proposta || {}) : (anterior.proposta || { encontrado: false }),
      declaracoes: rd?.sucesso ? (rd.declaracoes || []) : (anterior.declaracoes || []),
      lidoEm: new Date().toISOString(),
      arquivos: rp?.arquivoLido || rd?.arquivoLido || anterior.arquivos || '',
    }
    setModelos(m)
    setEscolhidas(m.declaracoes.map((_, i) => i))

    const falhas = []
    if (!rp?.sucesso) falhas.push('modelo de proposta: ' + (rp?.erro || 'sem resposta'))
    if (!rd?.sucesso) falhas.push('declarações: ' + (rd?.erro || 'sem resposta'))
    const extra = [rp?.aviso || rd?.aviso, falhas.length ? '⚠️ Não li o ' + falhas.join(' · ') + ' — use "Ler o edital de novo".' : '']
      .filter(Boolean).join(' ')

    // Salva na hora, como o resumo da IA: não depende de "Salvar status"
    const rs = await fetch('/api/licitacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto, modelosDocsJson: JSON.stringify(m) }),
    }).then(x => x.json()).catch(() => null)
    if (rs && rs.sucesso && !rs.aviso) {
      setAviso(`✅ Salvo: ${m.proposta?.encontrado === false ? 'proposta no formato padrão' : 'modelo de proposta'} e ${m.declaracoes.length} declaração(ões). ${extra}`)
      if (onAtualizado) onAtualizado()
    } else {
      setAviso('⚠️ Lido, mas não foi salvo na licitação: ' + ((rs && (rs.aviso || rs.erro)) || 'falha de conexão') + '. Dá para gerar agora mesmo assim. ' + extra)
    }
    setLendo(false)
  }

  async function gerar(tipo) {
    if (!lib || !empresa) return
    setGerando(tipo); setAviso('')
    try {
      const base = lib.nomeSeguro(`${lic.numeroEdital || 'edital'}_${empresa.nome || empresa.razao_social || ''}`)
      if (tipo === 'proposta') {
        await lib.baixarDocx(lib.gerarDocProposta({ modelos, itens: vencidos, empresa, lic }), `Proposta_${base}.docx`)
      } else {
        await lib.baixarDocx(lib.gerarDocDeclaracoes({ modelos, indices: escolhidas, empresa, lic }), `Declaracoes_${base}.docx`)
      }
    } catch (e) {
      setAviso('❌ Não consegui gerar o arquivo: ' + e.message)
    }
    setGerando('')
  }

  const alternar = i => setEscolhidas(a => a.includes(i) ? a.filter(x => x !== i) : [...a, i].sort((x, y) => x - y))
  const temAnexo = !!(lic.anexoDriveId || (lic.anexos && lic.anexos.length))

  return (
    <div className="form-sub" style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
      <label>📄 PROPOSTA E DECLARAÇÕES</label>

      {!modelos ? (
        <>
          <p className="dica-menus" style={{ marginTop: 0 }}>
            A IA lê o edital anexado e guarda o modelo de proposta e as declarações exigidas. Depois,
            os documentos saem preenchidos com os dados da empresa e os itens que vencemos.
          </p>
          <button className="btn-primary" style={{ marginTop: 0 }} disabled={lendo || !temAnexo} onClick={lerEdital}>
            {lendo ? (progresso || 'Lendo o edital...') : '🤖 Ler modelos do edital'}
          </button>
          {!temAnexo && <p className="dica-menus" style={{ marginTop: 6 }}>Anexe o PDF do edital em &quot;Editar&quot; antes.</p>}
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: '#374151', marginBottom: 8 }}>
            <strong>Proposta:</strong>{' '}
            {modelos.proposta?.encontrado === false
              ? 'o edital não traz modelo próprio — uso o formato padrão.'
              : (modelos.proposta?.fonte || 'modelo do edital')}
            {modelos.arquivos && <span style={{ color: '#94A3B8' }}> · lido de {modelos.arquivos}</span>}
          </div>

          {(modelos.declaracoes || []).length > 0 ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1B2E4B', marginBottom: 4 }}>
                Declarações ({escolhidas.length} de {modelos.declaracoes.length} marcadas)
              </div>
              {modelos.declaracoes.map((d, i) => (
                <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, fontWeight: 400, margin: '3px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={escolhidas.includes(i)} onChange={() => alternar(i)} style={{ width: 'auto', marginTop: 2 }} />
                  <span>{d.titulo}{d.fonte && <span style={{ color: '#94A3B8' }}> — {d.fonte}</span>}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="dica-menus">A IA não encontrou declarações exigidas neste edital.</p>
          )}

          {colunasExtras.length > 0 && vencidos.some(it => it._indice >= 0) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1B2E4B', marginBottom: 4 }}>
                O modelo pede {colunasExtras.map(c => ROTULO_EXTRA[c].toLowerCase()).join(', ')} — preencha nos itens vencidos
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl-proposta">
                  <thead><tr>
                    <th style={{ width: 44 }}>Nº</th><th>Descrição</th>
                    {colunasExtras.map(c => <th key={c} style={{ width: 140 }}>{ROTULO_EXTRA[c]}</th>)}
                  </tr></thead>
                  <tbody>
                    {vencidos.filter(it => it._indice >= 0).map(it => (
                      <tr key={it._indice}>
                        <td style={{ textAlign: 'center', color: '#64748B', fontWeight: 600 }}>{it.numero ?? ''}</td>
                        <td style={{ maxWidth: 260 }}>{it.descricao || '—'}</td>
                        {colunasExtras.map(c => (
                          <td key={c}><input value={itens[it._indice]?.[c] || ''}
                            onChange={ev => setItem(it._indice, c, ev.target.value)} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="dica-menus" style={{ marginTop: 4 }}>Fica guardado na licitação ao clicar em &quot;Salvar status&quot;.</p>
            </div>
          )}

          <div style={{ fontSize: 12.5, marginBottom: 8 }}>
            {vencidos.length > 0
              ? <span style={{ color: '#16A34A', fontWeight: 700 }}>🏆 {vencidos.length} item(ns) vencido(s) · total {moeda(total)}</span>
              : <span style={{ color: '#D97706' }}>Nenhum item vencido ainda — marque colocação 1 nos itens que vencemos (ou &quot;Ganhamos&quot; no resultado).</span>}
            {semPreco > 0 && <div style={{ color: '#DC2626' }}>⚠️ {semPreco} item(ns) vencido(s) sem lance preenchido.</div>}
            {extrasFaltando > 0 && <div style={{ color: '#D97706' }}>⚠️ {extrasFaltando} item(ns) sem {colunasExtras.map(c => ROTULO_EXTRA[c].toLowerCase()).join('/')} — sai destacado em amarelo.</div>}
            {faltam.length > 0 && (
              <div style={{ color: '#D97706' }}>
                ⚠️ Falta no cadastro da empresa: {faltam.join(', ')} — sai destacado em amarelo no Word.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-primary" style={{ marginTop: 0 }}
              disabled={!lib || !empresa || !vencidos.length || !!gerando} onClick={() => gerar('proposta')}>
              {gerando === 'proposta' ? 'Gerando...' : '⬇ Proposta (.docx)'}
            </button>
            <button className="btn-primary" style={{ marginTop: 0 }}
              disabled={!lib || !empresa || !escolhidas.length || !!gerando} onClick={() => gerar('declaracoes')}>
              {gerando === 'declaracoes' ? 'Gerando...' : `⬇ Declarações (.docx)`}
            </button>
            <button className="btn-ghost" disabled={lendo} onClick={lerEdital}>
              {lendo ? (progresso || 'Lendo...') : '↻ Ler o edital de novo'}
            </button>
          </div>
        </>
      )}

      {lendo && <p className="dica-menus" style={{ marginTop: 6 }}>Cada parte leva de 30 s a 2 min, conforme o tamanho do edital. Pode continuar com a tela aberta.</p>}
      {aviso && <div style={{ fontSize: 12.5, marginTop: 8, color: '#374151' }}>{aviso}</div>}
    </div>
  )
}
