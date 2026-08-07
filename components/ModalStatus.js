'use client'
import { useEffect, useState } from 'react'
import { FASES, FORMAS_VALOR, normalizarFase } from '@/lib/fases'
import { RESULTADOS, MOTIVOS_NAO_PARTICIPACAO, MOTIVOS_PERDA } from '@/lib/resultado'
import { CHECKLIST, avaliar } from '@/lib/checklist'
import { TIPOS_EVENTO, tipoEventoInfo } from '@/lib/tiposEvento'
import PainelCotacao from '@/components/PainelCotacao'
import Toggle from '@/components/Toggle'
import { enviarAoGAS } from '@/lib/gasClient'

const moeda = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const isoParaBR = v => { const p = String(v || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v }
const brParaISO = v => { const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
const itemVisivel = (it, busca, somenteSel) => {
  if (somenteSel && !it.participar) return false
  return !busca || String(it.descricao || '').toLowerCase().includes(busca.toLowerCase())
}

const CORES_VEREDITO = {
  descartar:  { bg: '#FEF2F2', bd: '#FECACA', cor: '#991B1B', ico: '⛔' },
  atencao:    { bg: '#FFFBEB', bd: '#FCD34D', cor: '#92400E', ico: '⚠️' },
  participar: { bg: '#F0FDF4', bd: '#BBF7D0', cor: '#166534', ico: '✅' },
  incompleto: { bg: '#F8FAFC', bd: '#E2E8F0', cor: '#64748B', ico: '📋' },
}

export default function ModalStatus({ lic, onFechar, onSalvo }) {
  const [fase, setFase] = useState(normalizarFase(lic.fase || 'Em analise'))
  const [f, setF] = useState({
    resultado: lic.resultado || 'Aguardando',
    motivo: lic.motivo || '',
    nossoLance: lic.nossoLance || '',
    valorVencedor: lic.valorVencedor || '',
    empresaVencedora: lic.empresaVencedora || '',
    colocacao: lic.colocacao || '',
    observacaoDisputa: lic.observacaoDisputa || '',
    dataSessao: lic.dataSessao || '',
    numeroProposta: lic.numeroProposta || '',
    dataHomologacao: brParaISO(lic.dataHomologacao) || '',
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

  // ── Checklist embutido na fase "Em análise" ──
  const [chkDados, setChkDados] = useState(() => {
    try { return JSON.parse(lic.checklistJson || '{}') } catch { return {} }
  })
  const [chkObs, setChkObs] = useState(() => {
    try { return (JSON.parse(lic.checklistJson || '{}')._obs) || '' } catch { return '' }
  })
  const [certAlerta, setCertAlerta] = useState(null)
  const [analisandoIA, setAnalisandoIA] = useState(false)
  const [resumoRiscos, setResumoRiscos] = useState(() => {
    try { return JSON.parse(lic.checklistJson || '{}')._riscos || '' } catch { return '' }
  })
  const [avisoIA, setAvisoIA] = useState('')

  useEffect(() => {
    if (fase !== 'Em analise') return
    fetch('/api/certidoes').then(r => r.json()).then(r => {
      if (!r.sucesso) return
      const daEmpresa = r.certidoes.filter(c => c.empresa_id === lic.empresa_id && c.tem_validade)
      setCertAlerta({
        vencidas: daEmpresa.filter(c => c.status === 'bad'),
        alerta: daEmpresa.filter(c => c.status === 'warn'),
      })
    }).catch(() => {})
  }, [fase, lic.empresa_id])

  const chkResultado = avaliar(chkDados)
  const chkResponder = (k, v) => setChkDados(d => ({ ...d, [k]: { ...(d[k] || {}), resposta: v } }))
  const chkDetalhar = (k, v) => setChkDados(d => ({ ...d, [k]: { ...(d[k] || {}), detalhe: v } }))
  // A decisão de participar já move a licitação para a fase correspondente
  const chkDecidir = v => setFase(v === 'Sim' ? 'Inscricao' : v === 'Não' ? 'Descartado' : 'Em analise')
  const chkDecisaoAtual = fase === 'Inscricao' ? 'Sim' : fase === 'Descartado' ? 'Não' : 'Pendente'

  // ── Registrar evento: cria um lembrete no calendário ligado à licitação;
  // alguns tipos (suspensão/remarcação) também atualizam a data da sessão ──
  const [eventoAberto, setEventoAberto] = useState(false)
  const [tipoEvento, setTipoEvento] = useState('suspensao')
  const [tituloEventoCustom, setTituloEventoCustom] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [obsEvento, setObsEvento] = useState('')
  const [salvandoEvento, setSalvandoEvento] = useState(false)
  const [avisoEvento, setAvisoEvento] = useState('')

  async function registrarEvento() {
    if (!dataEvento) { setAvisoEvento('Informe a data e hora do evento.'); return }
    const info = tipoEventoInfo(tipoEvento)
    if (tipoEvento === 'outro' && !tituloEventoCustom.trim()) { setAvisoEvento('Dê um título para o evento.'); return }
    setSalvandoEvento(true); setAvisoEvento('')
    try {
      const [dataParte] = dataEvento.split('T')
      const titulo = tipoEvento === 'outro'
        ? `${info.ico} ${tituloEventoCustom.trim()}: ${lic.numeroEdital || 'licitação'}`
        : `${info.ico} ${info.nome.split('(')[0].trim()}: ${lic.numeroEdital || 'licitação'}`

      const ev = await fetch('/api/calendario/eventos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo, data: dataParte, descricao: obsEvento || info.nome,
          empresaId: lic.empresa_id, licitacaoId: lic.id, licitacaoEdital: lic.numeroEdital, tipoEvento,
        }),
      }).then(x => x.json())
      if (!ev.sucesso) { setAvisoEvento(ev.erro || 'Erro ao criar o evento no calendário.'); setSalvandoEvento(false); return }

      if (info.statusLic) {
        await fetch('/api/licitacoes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto,
            status: info.statusLic,
          }),
        })
      }
      setAvisoEvento('✅ Evento registrado e adicionado ao calendário.' + (info.statusLic ? ' Status da licitação atualizado.' : ''))
      setDataEvento(''); setObsEvento(''); setTituloEventoCustom(''); setEventoAberto(false)
    } catch {
      setAvisoEvento('Erro de conexão.')
    }
    setSalvandoEvento(false)
  }

  const [anexoLocal, setAnexoLocal] = useState({ id: lic.anexoDriveId || '', url: lic.anexoDriveUrl || '', nome: '' })
  const temAnexo = !!(anexoLocal.id)
  const [arquivosEdital, setArquivosEdital] = useState(null)
  const [buscandoArquivos, setBuscandoArquivos] = useState(false)
  const [anexandoArquivo, setAnexandoArquivo] = useState('')

  async function buscarArquivosEdital() {
    // Prioriza o número de controle PNCP (estável) em vez do "Link do edital"
    // — depois que a licitação é extraída, esse campo passa a guardar o link
    // do portal de origem (Comprasnet, BLL...), não mais o link do PNCP.
    const referencia = lic.numeroPNCP || lic.link
    if (!referencia) { setAvisoIA('Esta licitação não tem nº de controle PNCP nem "Link do edital" cadastrado — inclua em "Editar".'); return }
    setAvisoIA(''); setBuscandoArquivos(true); setArquivosEdital(null)
    try {
      const r = await fetch('/api/licitacoes/arquivos-pncp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: referencia }),
      }).then(x => x.json())
      if (r.sucesso && r.arquivos?.length) setArquivosEdital(r.arquivos)
      else setAvisoIA(r.erro || 'Não achei documentos no PNCP para esta licitação.')
    } catch {
      setAvisoIA('Erro de conexão ao buscar documentos.')
    }
    setBuscandoArquivos(false)
  }

  async function anexarArquivoEdital(a) {
    setAnexandoArquivo(a.url); setAvisoIA('')
    try {
      const r = await fetch('/api/licitacoes/anexar-pncp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: a.url, nomeArquivo: a.nomeArquivo || a.titulo, empresaNome: lic.empresa_nome }),
      }).then(x => x.json())
      if (r.sucesso) {
        // Grava na hora, sem esperar o "Salvar status" — assim o resumo por
        // IA já pode ser usado em seguida, na mesma tela.
        setAnexoLocal({ id: r.id, url: r.url, nome: r.nome })
        await fetch('/api/licitacoes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto,
            anexoDriveId: r.id, anexoDriveUrl: r.url,
          }),
        })
        const ehZip = /\.zip$/i.test(r.nome || '')
        setAvisoIA(ehZip
          ? '⚠️ ' + a.titulo + ' anexado, mas é um arquivo .zip — a IA não consegue ler dentro de um zip. Abra o arquivo, extraia o PDF do edital e anexe ele direto (em "Editar").'
          : '✅ ' + a.titulo + ' anexado.')
      } else setAvisoIA('Falha em ' + a.titulo + ': ' + (r.erro || 'erro desconhecido'))
    } catch {
      setAvisoIA('Erro de conexão ao anexar ' + a.titulo + '.')
    }
    setAnexandoArquivo('')
  }
  async function resumirComIA() {
    if (!temAnexo) { setAvisoIA('Anexe o PDF do edital em "Editar" antes de usar a IA.'); return }
    if (/\.zip$/i.test(anexoLocal.nome || '')) {
      setAvisoIA('O anexo atual é um .zip — a IA só lê PDF/imagem diretamente. Extraia o PDF do edital de dentro do zip e anexe ele (em "Editar").')
      return
    }
    setAvisoIA(''); setAnalisandoIA(true)
    try {
      const r = await enviarAoGAS({ action: 'analisarChecklistGemini', licitacaoId: lic.id, empresaId: lic.empresa_id })
      if (!r || !r.sucesso) {
        setAvisoIA((r && r.erro) || 'Não foi possível ler o edital agora. Tente novamente em instantes.')
      } else {
        const g = r.checklist || {}
        setChkDados(d => {
          const novo = { ...d }
          Object.keys(g).forEach(k => {
            if (k.startsWith('_')) return
            novo[k] = { resposta: g[k].resposta || '', detalhe: g[k].detalhe || '' }
          })
          return novo
        })
        if (g._riscos) setResumoRiscos(g._riscos)
        setAvisoIA('✅ Edital lido e checklist preenchido pela IA — revise as respostas antes de decidir.')
      }
    } catch (e) {
      setAvisoIA('Erro: ' + e.message)
    }
    setAnalisandoIA(false)
  }

  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const setItem = (i, k, v) => setItens(a => a.map((it, j) => j === i ? { ...it, [k]: v } : it))

  const motivos = f.resultado === 'Nao participamos' ? MOTIVOS_NAO_PARTICIPACAO
    : (f.resultado === 'Perdemos' || f.resultado === 'Desclassificados') ? MOTIVOS_PERDA : null

  // Quando a forma é "% de desconto", o valor mínimo é um percentual sobre o
  // estimado, não um preço em R$ — aqui convertemos para o preço unitário
  // efetivo, para os totais funcionarem do mesmo jeito em qualquer forma.
  const precoEfetivo = it => {
    const estimado = Number(it.valorUnitarioRef) || 0
    const v = Number(it.meuValor) || 0
    if (it.formaValor === 'desconto') return estimado * (1 - v / 100)
    return v
  }

  const marcados = itens.filter(it => it.participar)
  const [buscaItem, setBuscaItem] = useState('')
  const [somenteSelecionados, setSomenteSelecionados] = useState(false)
  const semValor = marcados.filter(it => !String(it.meuValor).trim()).length
  // Total do que estamos de fato participando (só os itens marcados) e o
  // total da licitação inteira (todos os itens, pelo valor estimado) — útil
  // quando não participamos de todos os itens e precisamos comparar os dois.
  const totalParticipando = marcados.reduce((s, it) =>
    s + (Number(it.quantidade) || 0) * precoEfetivo(it), 0)
  const totalEstimadoParticipando = marcados.reduce((s, it) =>
    s + (Number(it.quantidade) || 0) * (Number(it.valorUnitarioRef) || 0), 0)
  const totalLicitacao = itens.reduce((s, it) =>
    s + (Number(it.quantidade) || 0) * (Number(it.valorUnitarioRef) || 0), 0)

  async function salvar(faseDestino) {
    const destino = faseDestino || fase
    setSalvando(true); setErro('')
    try {
      const corpo = {
        id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto,
        fase: destino, ...f,
        dataHomologacao: isoParaBR(f.dataHomologacao),
        itensJson: JSON.stringify(itens),
        checklistJson: JSON.stringify({ ...chkDados, _obs: chkObs, _veredito: chkResultado.veredito, _riscos: resumoRiscos }),
      }
      if (destino === 'Descartado') corpo.participar = 'Não'
      // Reabrir uma licitação encerrada: limpa o desfecho para não voltar sozinha
      const eraFinal = ['Finalizada', 'Descartado'].includes(lic.fase)
      if (eraFinal && !['Finalizada', 'Descartado'].includes(destino)) {
        corpo.resultado = 'Aguardando'
        corpo.motivo = ''
        corpo.status = 'Aberta'
      }
      if (['Inscricao', 'Aguardando', 'Disputa'].includes(destino)) corpo.participar = 'Sim'
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
            <div className="modal-hdr-sub">ANDAMENTO DA LICITAÇÃO</div>
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

          {/* ── Em análise: checklist de viabilidade embutido aqui ── */}
          {fase === 'Em analise' && (
            <div className="form-sub">
              {!temAnexo && (
                <div className="ia-resumo-box" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12.5, color: '#145653' }}>
                      <strong>📎 Anexar edital do PNCP</strong>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        Busca os documentos publicados no PNCP para esta licitação, sem precisar sair desta tela.
                      </div>
                    </div>
                    <button className="iBtn iBtn-up" onClick={buscarArquivosEdital} disabled={buscandoArquivos}>
                      {buscandoArquivos ? 'Buscando...' : '📎 Extrair arquivos do edital'}
                    </button>
                  </div>
                  {arquivosEdital && (
                    <div style={{ marginTop: 10 }}>
                      {arquivosEdital.map((a, i) => (
                        <div className="anexo-item" key={i}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {a.titulo}</span>
                          <button className="iBtn" disabled={anexandoArquivo === a.url} onClick={() => anexarArquivoEdital(a)}>
                            {anexandoArquivo === a.url ? 'Anexando...' : '⬇ Anexar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {temAnexo && anexoLocal.url && (
                <p className="dica-menus" style={{ marginTop: 0 }}>
                  📎 Edital anexado{anexoLocal.nome ? ': ' + anexoLocal.nome : ''} — <a href={anexoLocal.url} target="_blank" rel="noreferrer">abrir</a>
                </p>
              )}

              <div className="ia-resumo-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12.5, color: '#145653' }}>
                    <strong>🤖 Resumo do edital por IA</strong>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                      {temAnexo ? 'Lê o PDF anexado e preenche o checklist abaixo automaticamente.' : 'Anexe o edital acima para habilitar.'}
                    </div>
                  </div>
                  <button className="iBtn iBtn-up" onClick={resumirComIA} disabled={analisandoIA || !temAnexo}>
                    {analisandoIA ? '🤖 Lendo o edital... (15–40s)' : '🤖 Resumir com IA'}
                  </button>
                </div>
                {avisoIA && <p style={{ fontSize: 12, marginTop: 8, marginBottom: 0, color: avisoIA.startsWith('✅') ? '#166534' : '#B45309' }}>{avisoIA}</p>}
              </div>

              {resumoRiscos && (
                <div className="ia-riscos-box">
                  <strong>⚠️ Pontos de atenção (segundo a IA)</strong>
                  <p style={{ margin: '4px 0 0' }}>{resumoRiscos}</p>
                </div>
              )}

              <div className="veredito" style={{ background: CORES_VEREDITO[chkResultado.veredito].bg, borderColor: CORES_VEREDITO[chkResultado.veredito].bd, color: CORES_VEREDITO[chkResultado.veredito].cor }}>
                <div style={{ fontSize: 22 }}>{CORES_VEREDITO[chkResultado.veredito].ico}</div>
                <div>
                  <strong>{chkResultado.titulo}</strong>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{chkResultado.motivo}</div>
                  <div className="progresso"><span style={{ width: (chkResultado.respondidos / chkResultado.total * 100) + '%' }} /></div>
                </div>
              </div>

              {certAlerta && (certAlerta.vencidas.length > 0 || certAlerta.alerta.length > 0) && (
                <div className="aviso-box" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B', marginTop: 10 }}>
                  <strong>Atenção às certidões desta empresa:</strong>
                  {certAlerta.vencidas.length > 0 && <div>⛔ {certAlerta.vencidas.length} vencida(s): {certAlerta.vencidas.map(c => c.tipo).join(', ')}</div>}
                  {certAlerta.alerta.length > 0 && <div>⚠️ {certAlerta.alerta.length} vence(m) em até 7 dias: {certAlerta.alerta.map(c => c.tipo).join(', ')}</div>}
                </div>
              )}

              {CHECKLIST.map(sec => (
                <div key={sec.secao} style={{ marginTop: 16 }}>
                  <div className="chk-secao">
                    {sec.secao}
                    <span>{sec.desc}</span>
                  </div>
                  {sec.itens.map(it => {
                    const r = chkDados[it.k]?.resposta || ''
                    const reprovado = chkResultado.reprovados.includes(it.k)
                    return (
                      <div className={'chk-item' + (reprovado ? ' reprovado' : '')} key={it.k}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div className="chk-titulo">
                            {it.label}
                            {it.eliminatorio && <span className="tag-elim">eliminatório</span>}
                          </div>
                          <div className="chk-pergunta">{it.pergunta}</div>
                          <div className="chk-ajuda">{it.ajuda}</div>
                          <input className="chk-detalhe-input" placeholder="Anotação (o que o edital diz, nº da cláusula...)"
                            value={chkDados[it.k]?.detalhe || ''} onChange={e => chkDetalhar(it.k, e.target.value)} />
                        </div>
                        <div className="chk-sn">
                          {[['S', 'Sim'], ['N', 'Não'], ['NA', 'N/A']].map(([v, l]) => (
                            <button key={v} className={'chk-btn' + (r === v ? ' ' + (v === 'N' ? 'n' : 's') : '')}
                              onClick={() => chkResponder(it.k, v)}>{l}</button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              <div className="form-sub" style={{ marginTop: 14 }}>
                <label>OBSERVAÇÕES DO CHECKLIST</label>
                <textarea rows={2} value={chkObs} onChange={e => setChkObs(e.target.value)} placeholder="Estratégia de lance, preço-alvo, riscos..." />
              </div>

              <div className="form-sub">
                <label>DECISÃO DE PARTICIPAÇÃO</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['Sim', '✅ Participar → Inscrição de proposta'], ['Não', '❌ Não participar → Descartado'], ['Pendente', '⏳ Pendente']].map(([v, l]) => (
                    <button key={v} className={'dec-btn' + (chkDecisaoAtual === v ? ' on' : '')} onClick={() => chkDecidir(v)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Inscrição de proposta: escolher itens e preços ── */}
          {fase === 'Inscricao' && (
            <div className="form-sub">
              <label>Nº DA PROPOSTA NO PORTAL</label>
              <input value={f.numeroProposta} onChange={e => set('numeroProposta', e.target.value)}
                placeholder="Ex: 62335" style={{ maxWidth: 200 }} />
              <p className="dica-menus" style={{ marginTop: 4 }}>
                Número gerado pelo portal (ComprasNet etc.) ao cadastrar a proposta — usado como referência no relatório mensal.
              </p>
            </div>
          )}

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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <input className="busca-input" style={{ flex: 1, minWidth: 160 }} placeholder="Buscar item por descrição..."
                    value={buscaItem} onChange={e => setBuscaItem(e.target.value)} />
                  <Toggle ligado={somenteSelecionados} onChange={setSomenteSelecionados} label="Somente selecionados" />
                  <button className="iBtn" onClick={() => setItens(a => a.map((it, i) =>
                    itemVisivel(it, buscaItem, somenteSelecionados) ? { ...it, participar: true } : it))}>Marcar todos</button>
                  <button className="iBtn" onClick={() => setItens(a => a.map((it, i) =>
                    itemVisivel(it, buscaItem, somenteSelecionados) ? { ...it, participar: false } : it))}>Desmarcar todos</button>
                </div>
              )}
              {itens.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl-proposta">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>Vou</th>
                        {itens.some(it => it.grupo) && <th style={{ width: 90 }}>Grupo</th>}
                        <th>Descrição</th>
                        <th style={{ width: 70 }}>Qtd</th>
                        <th style={{ width: 60 }}>Un</th>
                        <th style={{ width: 110 }}>Estimado</th>
                        <th style={{ width: 120 }}>Valor mínimo</th>
                        <th style={{ width: 120 }}>Forma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => itemVisivel(it, buscaItem, somenteSelecionados) && (
                        <tr key={i} style={{ opacity: it.participar ? 1 : .45 }}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={it.participar}
                              onChange={e => setItem(i, 'participar', e.target.checked)} />
                          </td>
                          {itens.some(x => x.grupo) && (
                            <td>
                              {it.grupo || '—'}
                              {it.grupo && (
                                <button className="iBtn" style={{ display: 'block', marginTop: 4, fontSize: 10, padding: '2px 6px' }}
                                  onClick={() => setItens(a => a.map(x => x.grupo === it.grupo ? { ...x, participar: !it.participar } : x))}>
                                  marcar grupo
                                </button>
                              )}
                            </td>
                          )}
                          <td style={{ maxWidth: 320 }}>{it.descricao || '—'}</td>
                          <td>{it.quantidade || '—'}</td>
                          <td>{it.unidade || '—'}</td>
                          <td style={{ color: '#64748B' }}>
                            {it.valorUnitarioRef ? moeda(it.valorUnitarioRef) : 'Sigiloso'}
                          </td>
                          <td>
                            <input type="number" step="0.01" value={it.meuValor}
                              disabled={!it.participar}
                              onChange={e => setItem(i, 'meuValor', e.target.value)}
                              placeholder={it.formaValor === 'desconto' ? '% desconto' : '0,00'} />
                            {it.formaValor === 'desconto' && it.meuValor && it.valorUnitarioRef && (
                              <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                                = {moeda(precoEfetivo(it))}
                              </div>
                            )}
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
              {itens.some(it => it.grupo) && (
                <p className="dica-menus">Licitação por grupo/lote — o botão "marcar grupo" liga ou desliga todos os itens do mesmo grupo de uma vez.</p>
              )}
              <p className="dica-menus">
                {marcados.length} de {itens.length} itens marcados
                {semValor > 0 && ` · ${semValor} ainda sem valor`}
              </p>
              {itens.length > 0 && (
                <div className="totais-proposta">
                  <div>
                    <span className="lic-campo-lbl">VALOR ESTIMADO — ITENS PARTICIPANDO</span>
                    <span className="lic-campo-val">{moeda(totalEstimadoParticipando)}</span>
                  </div>
                  <div>
                    <span className="lic-campo-lbl">NOSSO VALOR MÍNIMO — ITENS PARTICIPANDO</span>
                    <span className="lic-campo-val" style={{ color: '#16A34A' }}>{moeda(totalParticipando)}</span>
                  </div>
                  <div>
                    <span className="lic-campo-lbl">VALOR ESTIMADO — LICITAÇÃO INTEIRA</span>
                    <span className="lic-campo-val">{moeda(totalLicitacao)}</span>
                  </div>
                </div>
              )}
              <PainelCotacao lic={lic} itens={itens} setItens={setItens} marcados={marcados} />
            </div>
          )}

          {/* ── Aguardando: data e hora da sessão ── */}
          {['Aguardando', 'Disputa'].includes(fase) && (
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

          {['Aguardando', 'Disputa'].includes(fase) && (
            <div className="form-sub">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>📅 Eventos da licitação</label>
                <button className="iBtn" onClick={() => setEventoAberto(a => !a)}>
                  {eventoAberto ? 'Fechar' : '+ Registrar evento'}
                </button>
              </div>
              {eventoAberto && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: 12, marginTop: 8 }}>
                  <p className="dica-menus" style={{ marginTop: 0 }}>
                    Registra qualquer evento que aconteça no meio do processo — suspensão, diligência, recurso, reunião etc.
                    — e já cria um lembrete no calendário. A data da sessão não muda sozinha; se precisar corrigir, ajuste
                    o campo "Data da sessão" ali em cima manualmente. Suspensão marca a licitação como "Suspensa".
                  </p>
                  <label className="mini-lbl">TIPO DE EVENTO</label>
                  <select value={tipoEvento} onChange={e => setTipoEvento(e.target.value)}>
                    {TIPOS_EVENTO.map(t => <option key={t.id} value={t.id}>{t.ico} {t.nome}</option>)}
                  </select>
                  {tipoEvento === 'outro' && (
                    <>
                      <label className="mini-lbl" style={{ marginTop: 8, display: 'block' }}>TÍTULO DO EVENTO</label>
                      <input value={tituloEventoCustom} onChange={e => setTituloEventoCustom(e.target.value)} placeholder="Ex: Visita técnica ao órgão" />
                    </>
                  )}
                  <label className="mini-lbl" style={{ marginTop: 8, display: 'block' }}>DATA E HORA DO EVENTO</label>
                  <input type="datetime-local" value={dataEvento} onChange={e => setDataEvento(e.target.value)} />
                  <label className="mini-lbl" style={{ marginTop: 8, display: 'block' }}>OBSERVAÇÃO (opcional)</label>
                  <textarea rows={2} value={obsEvento} onChange={e => setObsEvento(e.target.value)} placeholder="Detalhes do evento..." />
                  {avisoEvento && <p style={{ fontSize: 12, marginTop: 8, color: avisoEvento.startsWith('✅') ? '#166534' : '#B45309' }}>{avisoEvento}</p>}
                  <button className="iBtn iBtn-up" style={{ marginTop: 8 }} onClick={registrarEvento} disabled={salvandoEvento}>
                    {salvandoEvento ? 'Registrando...' : '📅 Registrar evento e adicionar ao calendário'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Disputa: lance, colocação e vencedor — por item quando houver itens ── */}
          {['Disputa', 'Finalizada'].includes(fase) && (
            itens.length > 0 ? (
              <div className="form-sub">
                <label>NOSSO LANCE E VENCEDOR POR ITEM</label>
                <p className="dica-menus" style={{ marginTop: 0, marginBottom: 8 }}>
                  Só os itens marcados na Inscrição de proposta aparecem aqui.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl-proposta">
                    <thead>
                      <tr>
                        <th>Descrição</th>
                        <th style={{ width: 70 }}>Qtd</th>
                        <th style={{ width: 110 }}>Nosso lance</th>
                        <th style={{ width: 110 }}>Total do item</th>
                        <th style={{ width: 70 }}>Colocação</th>
                        <th style={{ width: 160 }}>Empresa vencedora</th>
                        <th style={{ width: 110 }}>Preço vencedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, i) => it.participar && (
                        <tr key={i}>
                          <td style={{ maxWidth: 260 }}>{it.descricao || '—'}</td>
                          <td>{it.quantidade || '—'}</td>
                          <td><input type="number" step="0.01" value={it.lanceFinal || ''} placeholder={it.meuValor || '0,00'}
                            onChange={e => setItem(i, 'lanceFinal', e.target.value)} /></td>
                          <td style={{ fontWeight: 700, color: '#1B2E4B', whiteSpace: 'nowrap' }}>
                            {moeda((Number(it.lanceFinal || it.meuValor) || 0) * (Number(it.quantidade) || 0))}
                          </td>
                          <td><input type="number" min="1" value={it.colocacao || ''} placeholder="1"
                            onChange={e => setItem(i, 'colocacao', e.target.value)} /></td>
                          <td><input value={it.vencedorNome || ''} placeholder="Nome do concorrente"
                            onChange={e => setItem(i, 'vencedorNome', e.target.value)} /></td>
                          <td><input type="number" step="0.01" value={it.vencedorPreco || ''}
                            onChange={e => setItem(i, 'vencedorPreco', e.target.value)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="totais-proposta" style={{ marginTop: 10 }}>
                  <div>
                    <span className="lic-campo-lbl">VALOR TOTAL DA CONTRATAÇÃO (NOSSOS LANCES)</span>
                    <span className="lic-campo-val" style={{ color: '#16A34A', fontSize: 16 }}>
                      {moeda(itens.filter(it => it.participar).reduce((s, it) =>
                        s + (Number(it.lanceFinal || it.meuValor) || 0) * (Number(it.quantidade) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
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
            )
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
              {fase === 'Finalizada' && (
                <div className="form-sub">
                  <label>DATA DA HOMOLOGAÇÃO</label>
                  <input type="date" value={f.dataHomologacao} onChange={e => set('dataHomologacao', e.target.value)} />
                  <p className="dica-menus" style={{ marginTop: 4 }}>
                    Importante para o relatório mensal — é o mês em que a licitação entra no relatório, não o mês em que foi aberta.
                  </p>
                </div>
              )}
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
