'use client'
import { useCallback, useEffect, useState } from 'react'
import { FASES, FORMAS_VALOR, normalizarFase } from '@/lib/fases'
import { RESULTADOS, MOTIVOS_NAO_PARTICIPACAO, MOTIVOS_PERDA } from '@/lib/resultado'
import { gerarResumoItens } from '@/lib/checklist'
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

export default function ModalStatus({ lic, onFechar, onSalvo }) {
  const [fase, setFase] = useState(normalizarFase(lic.fase || 'Em analise'))
  const [resumoEmail, setResumoEmail] = useState('')
  const [resumoEmailAberto, setResumoEmailAberto] = useState(false)
  const [resumoEmailEnviando, setResumoEmailEnviando] = useState(false)
  const [resumoEmailMsg, setResumoEmailMsg] = useState('')
  const [resumoEmailHistorico, setResumoEmailHistorico] = useState(() => {
    try { return JSON.parse(lic.resumoEmailsJson || '[]') } catch { return [] }
  })

  function abrirResumoEmail() {
    setResumoEmailAberto(true); setResumoEmailMsg('')
    if (!resumoEmail) {
      fetch('/api/empresas').then(r => r.json()).then(r => {
        const emp = r.sucesso && r.empresas?.find(e => e.id === lic.empresa_id)
        if (emp?.email) setResumoEmail(emp.email)
      }).catch(() => {})
    }
  }

  async function enviarResumoEmail() {
    if (!resumoEmail.trim()) { setResumoEmailMsg('Informe o e-mail de destino.'); return }
    setResumoEmailEnviando(true); setResumoEmailMsg('')
    try {
      const r = await fetch('/api/licitacoes/resumo-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licitacaoId: lic.id, destinatarioEmail: resumoEmail.trim() }),
      }).then(x => x.json())
      setResumoEmailMsg(r.sucesso ? '✅ Resumo enviado.' : '❌ ' + (r.erro || 'Erro ao enviar.'))
      if (r.sucesso && r.historico) setResumoEmailHistorico(r.historico)
    } catch { setResumoEmailMsg('❌ Erro de conexão.') }
    setResumoEmailEnviando(false)
  }

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
  const [certAlerta, setCertAlerta] = useState(null)
  const [analisandoIA, setAnalisandoIA] = useState(false)
  const [resumoRiscos, setResumoRiscos] = useState(() => {
    try { return JSON.parse(lic.checklistJson || '{}')._riscos || '' } catch { return '' }
  })
  const [avisoIA, setAvisoIA] = useState('')

  // Descartado só faz sentido como "não participamos" — nunca chegou a
  // disputar, então marca sozinho pra já mostrar a lista de motivos.
  useEffect(() => {
    if (fase === 'Descartado' && f.resultado !== 'Nao participamos') set('resultado', 'Nao participamos')
  }, [fase]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // A decisão de participar já move a licitação para a fase correspondente
  // A decisão de participar é um dado próprio da licitação (campo `participar`),
  // não pode ser deduzida da aba que está aberta na tela: ao voltar para a aba
  // "Em análise" de uma licitação já decidida, a fase visível vira 'Em analise'
  // e a decisão aparecia como Pendente de novo — era o que fazia todas
  // parecerem pendentes.
  const [decisao, setDecisao] = useState(lic.participar || 'Pendente')
  const chkDecidir = v => {
    setDecisao(v)
    setFase(v === 'Sim' ? 'Inscricao' : v === 'Não' ? 'Descartado' : 'Em analise')
  }
  const chkDecisaoAtual = decisao

  // ── Registrar evento: cria um lembrete no calendário ligado à licitação;
  // alguns tipos (suspensão/remarcação) também atualizam a data da sessão ──
  const [eventoAberto, setEventoAberto] = useState(false)
  const [tipoEvento, setTipoEvento] = useState('suspensao')
  const [tituloEventoCustom, setTituloEventoCustom] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [obsEvento, setObsEvento] = useState('')
  const [salvandoEvento, setSalvandoEvento] = useState(false)
  const [avisoEvento, setAvisoEvento] = useState('')
  // Nos tipos que remarcam (suspensão com retorno, remarcação), a data
  // informada é a nova data da sessão — vem marcado, mas dá para desmarcar.
  const [atualizarSessao, setAtualizarSessao] = useState(true)
  const [historico, setHistorico] = useState(null)

  const carregarHistorico = useCallback(() => {
    fetch('/api/calendario/eventos').then(r => r.json())
      .then(r => setHistorico(r.sucesso
        ? r.eventos.filter(e => String(e.licitacaoId || '') === String(lic.id))
            .sort((a, b) => String(b.data).localeCompare(String(a.data)))
        : []))
      .catch(() => setHistorico([]))
  }, [lic.id])
  useEffect(() => { carregarHistorico() }, [carregarHistorico])

  async function registrarEvento() {
    if (!dataEvento) { setAvisoEvento('Informe a data e hora do evento.'); return }
    const info = tipoEventoInfo(tipoEvento)
    if (tipoEvento === 'outro' && !tituloEventoCustom.trim()) { setAvisoEvento('Dê um título para o evento.'); return }
    setSalvandoEvento(true); setAvisoEvento('')
    try {
      const [dataParte, horaParte] = dataEvento.split('T')
      const titulo = tipoEvento === 'outro'
        ? `${info.ico} ${tituloEventoCustom.trim()}: ${lic.numeroEdital || 'licitação'}`
        : `${info.ico} ${info.nome.split('(')[0].trim()}: ${lic.numeroEdital || 'licitação'}`

      const ev = await fetch('/api/calendario/eventos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo, data: dataParte, hora: horaParte || '', descricao: obsEvento || info.nome,
          empresaId: lic.empresa_id, licitacaoId: lic.id, licitacaoEdital: lic.numeroEdital, tipoEvento,
        }),
      }).then(x => x.json())
      if (!ev.sucesso) { setAvisoEvento(ev.erro || 'Erro ao criar o evento no calendário.'); setSalvandoEvento(false); return }

      // O campo do evento é datetime-local (aaaa-mm-ddThh:mm); a data da
      // sessão é guardada no formato brasileiro. Converte antes de gravar.
      const m = dataEvento.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
      const sessaoBR = m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : ''
      const remarcar = info.remarcaSessao && atualizarSessao && !!sessaoBR
      if (info.statusLic || remarcar) {
        await fetch('/api/licitacoes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto,
            ...(info.statusLic ? { status: info.statusLic } : {}),
            ...(remarcar ? { dataSessao: sessaoBR } : {}),
          }),
        })
        if (remarcar) set('dataSessao', sessaoBR)
      }
      setAvisoEvento('✅ Evento registrado e adicionado ao calendário.'
        + (info.statusLic ? ' Status da licitação atualizado.' : '')
        + (remarcar ? ' Data da sessão atualizada.' : ''))
      setDataEvento(''); setObsEvento(''); setTituloEventoCustom(''); setEventoAberto(false)
      carregarHistorico()
    } catch {
      setAvisoEvento('Erro de conexão.')
    }
    setSalvandoEvento(false)
  }

  const [anexoLocal, setAnexoLocal] = useState({ id: lic.anexoDriveId || '', url: lic.anexoDriveUrl || '', nome: '' })
  const temAnexo = !!(anexoLocal.id)
  // A busca/anexo dos documentos do PNCP vive na tela de Incluir/Editar
  // licitação. Esta fase só lê o edital já anexado.

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
        const novoChkDados = { ...chkDados }
        Object.keys(g).forEach(k => {
          if (k.startsWith('_')) return
          novoChkDados[k] = { resposta: g[k].resposta || '', detalhe: g[k].detalhe || '' }
        })
        setChkDados(novoChkDados)
        if (g._riscos) setResumoRiscos(g._riscos)

        // Salva na hora — sem isso, o resumo só existia na tela e sumia do
        // PDF/e-mail/detalhe até alguém lembrar de clicar em "Salvar status".
        try {
          await fetch('/api/licitacoes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto,
              checklistJson: JSON.stringify({ ...novoChkDados, _riscos: g._riscos || resumoRiscos }),
            }),
          })
          setAvisoIA('✅ Edital lido e resumo salvo — já aparece no PDF, no detalhe e no e-mail.')
        } catch {
          setAvisoIA('⚠️ Edital lido, mas houve um erro ao salvar automaticamente — clique em "Salvar status" antes de sair.')
        }
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
  // Em análise mostra o catálogo inteiro (é onde se escolhe); na Inscrição de
  // proposta só os itens escolhidos, que é o que se vai precificar. O toggle
  // continua ali para conferir ou corrigir uma marcação esquecida.
  // Só a fase Em análise usa este filtro (é onde se escolhe). A Inscrição de
  // proposta mostra sempre e apenas os itens escolhidos lá, sem alternância.
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
        checklistJson: JSON.stringify({ ...chkDados, _riscos: resumoRiscos }),
      }
      corpo.participar = decisao
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

          {/* ── Em análise: resumo do edital embutido aqui, num cartão só ── */}
          {fase === 'Em analise' && (
            <div className="form-sub">
              <div className="ia-resumo-box">
                {/* Anexar o edital é tarefa da tela de Incluir/Editar licitação.
                    Aqui a análise só lê o que já está anexado. */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {temAnexo ? (
                    <p className="dica-menus" style={{ margin: 0 }}>
                      📎 Edital anexado{anexoLocal.nome ? ': ' + anexoLocal.nome : ''} — <a href={anexoLocal.url} target="_blank" rel="noreferrer">abrir</a>
                    </p>
                  ) : (
                    <div style={{ fontSize: 12.5, color: '#B45309' }}>
                      <strong>Nenhum edital anexado</strong>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        Feche e use “✏️ Editar” na licitação para anexar o arquivo ou extrair os documentos do PNCP.
                      </div>
                    </div>
                  )}
                  <button className="iBtn iBtn-up" onClick={resumirComIA} disabled={analisandoIA || !temAnexo}
                    title={temAnexo ? 'Lê o PDF do edital e monta o resumo' : 'Anexe o edital na edição da licitação primeiro'}>
                    {analisandoIA ? '🤖 Lendo o edital... (15–40s)' : '🤖 Resumir com IA'}
                  </button>
                </div>
                {avisoIA && <p style={{ fontSize: 12, marginTop: 8, marginBottom: 0, color: avisoIA.startsWith('✅') ? '#166534' : '#B45309' }}>{avisoIA}</p>}

                {/* ── Resumo em texto — análise geral + itens, é o principal conteúdo desta fase ── */}
                {(() => {
                  const itensResumo = gerarResumoItens(chkDados)
                  const anexos = (lic.anexos?.length ? lic.anexos : (lic.anexoDriveUrl ? [{ nome: 'Edital', url: lic.anexoDriveUrl }] : []))
                  return (
                    <div style={{ marginTop: 10, borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <strong style={{ color: '#145653' }}>📄 Resumo do edital</strong>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <a className="iBtn" href={`/dashboard/licitacoes/resumo?id=${lic.id}`} target="_blank" rel="noreferrer">
                            📄 Ver em PDF
                          </a>
                          <button className="iBtn" onClick={() => (resumoEmailAberto ? setResumoEmailAberto(false) : abrirResumoEmail())}>
                            📧 Enviar por e-mail
                          </button>
                        </div>
                      </div>
                      {resumoEmailHistorico.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          {resumoEmailHistorico.slice().reverse().map((h, i) => (
                            <p key={i} style={{ fontSize: 11.5, color: '#6B7280', margin: '2px 0' }}>
                              ✅ Enviado para <strong>{h.para}</strong> em {new Date(h.enviadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          ))}
                        </div>
                      )}
                      {resumoRiscos && (
                        <p style={{ fontSize: 12.5, marginTop: 8, marginBottom: 0, color: '#2E2D2F', lineHeight: 1.6 }}>{resumoRiscos}</p>
                      )}
                      <div style={{ marginTop: resumoRiscos ? 10 : 6 }}>
                        {itensResumo.length > 0 ? itensResumo.map((it, i) => (
                          <p key={i} style={{ fontSize: 12.5, marginBottom: 8, lineHeight: 1.5 }}>
                            <strong style={{ textTransform: 'uppercase', display: 'block', color: '#145653', fontSize: 11.5 }}>{it.label}</strong>
                            <span style={{ color: '#374151' }}>{it.resposta}{it.detalhe ? ' — ' + it.detalhe : ''}</span>
                          </p>
                        )) : <span style={{ color: '#94A3B8', fontSize: 12.5 }}>Ainda sem dados — use "🤖 Resumir com IA" acima.</span>}
                      </div>
                      {anexos.length > 0 && (
                        <div style={{ marginTop: 10, borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
                          <strong style={{ fontSize: 12, color: '#145653' }}>Anexos</strong>
                          {anexos.map((a, i) => (
                            <div key={i}><a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>📎 {a.nome || 'Anexo'}</a></div>
                          ))}
                        </div>
                      )}
                      {resumoEmailAberto && (
                        <div style={{ marginTop: 10, borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
                          <p style={{ fontSize: 11.5, color: '#6B7280', margin: '0 0 6px' }}>
                            Manda este mesmo resumo por e-mail — pra empresa decidir se vale a pena participar.
                          </p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input type="email" value={resumoEmail} onChange={e => setResumoEmail(e.target.value)}
                              placeholder="email@empresa.com.br" style={{ flex: 1 }} />
                            <button className="iBtn" disabled={resumoEmailEnviando} onClick={enviarResumoEmail}>
                              {resumoEmailEnviando ? 'Enviando...' : 'Enviar'}
                            </button>
                          </div>
                          {resumoEmailMsg && <p style={{ fontSize: 12, margin: '6px 0 0' }}>{resumoEmailMsg}</p>}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {certAlerta && (certAlerta.vencidas.length > 0 || certAlerta.alerta.length > 0) && (
                <div className="aviso-box" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B', marginTop: 10 }}>
                  <strong>Atenção às certidões desta empresa:</strong>
                  {certAlerta.vencidas.length > 0 && <div>⛔ {certAlerta.vencidas.length} vencida(s): {certAlerta.vencidas.map(c => c.tipo).join(', ')}</div>}
                  {certAlerta.alerta.length > 0 && <div>⚠️ {certAlerta.alerta.length} vence(m) em até 7 dias: {certAlerta.alerta.map(c => c.tipo).join(', ')}</div>}
                </div>
              )}

              {/* Selecao dos itens ja na analise: aqui aparece o catalogo inteiro
                  e voce marca no que vale a pena entrar. Na Inscricao de proposta
                  so os marcados aparecem, para precificar. */}
              {itens.length > 0 && (
                <div className="form-sub">
                  <label>ITENS DA LICITAÇÃO — MARQUE EM QUAIS VAMOS PARTICIPAR</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <input className="busca-input" style={{ flex: 1, minWidth: 160 }} placeholder="Buscar item por descrição..."
                      value={buscaItem} onChange={e => setBuscaItem(e.target.value)} />
                    <Toggle ligado={somenteSelecionados} onChange={setSomenteSelecionados} label="Somente selecionados" />
                    <button className="iBtn" onClick={() => setItens(a => a.map(it =>
                      itemVisivel(it, buscaItem, somenteSelecionados) ? { ...it, participar: true } : it))}>Marcar todos</button>
                    <button className="iBtn" onClick={() => setItens(a => a.map(it =>
                      itemVisivel(it, buscaItem, somenteSelecionados) ? { ...it, participar: false } : it))}>Desmarcar todos</button>
                  </div>
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
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((it, i) => itemVisivel(it, buscaItem, somenteSelecionados) && (
                          <tr key={i} style={{ opacity: it.participar ? 1 : .45 }}>
                            <td style={{ textAlign: 'center' }}>
                              <input type="checkbox" checked={!!it.participar}
                                onChange={e => setItem(i, 'participar', e.target.checked)} />
                            </td>
                            {itens.some(x => x.grupo) && (
                              <td style={{ fontSize: 11.5 }}>
                                {it.grupo || '—'}
                                {it.grupo && (
                                  <button className="iBtn" style={{ marginLeft: 4, padding: '1px 5px', fontSize: 10 }}
                                    title="Marcar/desmarcar o grupo inteiro"
                                    onClick={() => setItens(a => a.map(x => x.grupo === it.grupo ? { ...x, participar: !it.participar } : x))}>
                                    grupo
                                  </button>
                                )}
                              </td>
                            )}
                            <td>{it.descricao}</td>
                            <td style={{ textAlign: 'center' }}>{it.quantidade}</td>
                            <td style={{ textAlign: 'center' }}>{it.unidade}</td>
                            <td style={{ textAlign: 'right' }}>
                              {it.valorUnitarioRef ? moeda(it.valorUnitarioRef) : 'Sigiloso'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="dica-menus" style={{ marginTop: 6 }}>
                    {marcados.length} de {itens.length} item(ns) marcado(s). Os preços são definidos na próxima fase,
                    Inscrição de proposta, onde só estes itens aparecem.
                  </p>
                </div>
              )}

              <div className="form-sub">
                <label>DECISÃO DE PARTICIPAÇÃO</label>
                {decisao !== 'Pendente' && (
                  <p className="dica-menus" style={{ marginTop: 0 }}>
                    Já decidido: <strong>{decisao === 'Sim' ? 'vamos participar' : 'não vamos participar'}</strong>.
                    Clicar de novo muda a decisão e a fase; é preciso salvar para valer.
                  </p>
                )}
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
              {itens.length > 0 && marcados.length === 0 && (
                <div className="aviso-box" style={{ marginBottom: 8 }}>
                  Nenhum item marcado. A escolha dos itens é feita na fase <strong>Em análise</strong> —
                  volte lá pela trilha acima e marque em quais vamos participar.
                </div>
              )}
              {/* Aqui aparecem SÓ os itens escolhidos na fase Em análise — esta
                  fase é para precificar, não para escolher. Sem toggle. */}
              {marcados.length > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <input className="busca-input" style={{ flex: 1, minWidth: 160 }} placeholder="Buscar item por descrição..."
                    value={buscaItem} onChange={e => setBuscaItem(e.target.value)} />
                  <span style={{ fontSize: 11.5, color: '#64748B' }}>
                    {marcados.length} item(ns) escolhido(s) na análise
                  </span>
                </div>
              )}
              {itens.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl-proposta">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
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
                      {itens.map((it, i) => itemVisivel(it, buscaItem, true) && (
                        <tr key={i}>
                          <td style={{ textAlign: 'center' }}>
                            <button className="iBtn iBtn-del" title="Tirar este item da proposta"
                              onClick={() => setItem(i, 'participar', false)}>×</button>
                          </td>
                          {itens.some(x => x.grupo) && (
                            <td>
                              {it.grupo || '—'}
                              {it.grupo && (
                                <button className="iBtn" style={{ display: 'block', marginTop: 4, fontSize: 10, padding: '2px 6px' }}
                                  title="Tirar o grupo inteiro da proposta"
                                  onClick={() => setItens(a => a.map(x => x.grupo === it.grupo ? { ...x, participar: false } : x))}>
                                  tirar grupo
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

          {/* Registrar evento só faz sentido com a sessão em jogo; o histórico
              vale em qualquer fase — é o registro do que aconteceu no processo. */}
          {(['Aguardando', 'Disputa'].includes(fase) || (historico && historico.length > 0)) && (
            <div className="form-sub">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>📅 Histórico de eventos da licitação</label>
                {['Aguardando', 'Disputa'].includes(fase) && (
                  <button className="iBtn" onClick={() => setEventoAberto(a => !a)}>
                    {eventoAberto ? 'Fechar' : '+ Registrar evento'}
                  </button>
                )}
              </div>
              {eventoAberto && ['Aguardando', 'Disputa'].includes(fase) && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: 12, marginTop: 8 }}>
                  <p className="dica-menus" style={{ marginTop: 0 }}>
                    Registra qualquer evento que aconteça no meio do processo — suspensão, diligência, recurso, reunião etc.
                    — e já cria um lembrete no calendário. Suspensão marca a licitação como "Suspensa".
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
                  {tipoEventoInfo(tipoEvento).remarcaSessao && (
                    <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 8, fontSize: 12.5, color: '#374151', cursor: 'pointer' }}>
                      <input type="checkbox" checked={atualizarSessao} onChange={e => setAtualizarSessao(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>
                        Usar esta data como a nova <strong>data da sessão</strong> da licitação
                        {f.dataSessao ? ` (hoje: ${f.dataSessao})` : ''}
                      </span>
                    </label>
                  )}
                  <label className="mini-lbl" style={{ marginTop: 8, display: 'block' }}>OBSERVAÇÃO (opcional)</label>
                  <textarea rows={2} value={obsEvento} onChange={e => setObsEvento(e.target.value)} placeholder="Detalhes do evento..." />
                  {avisoEvento && <p style={{ fontSize: 12, marginTop: 8, color: avisoEvento.startsWith('✅') ? '#166534' : '#B45309' }}>{avisoEvento}</p>}
                  <button className="iBtn iBtn-up" style={{ marginTop: 8 }} onClick={registrarEvento} disabled={salvandoEvento}>
                    {salvandoEvento ? 'Registrando...' : '📅 Registrar evento e adicionar ao calendário'}
                  </button>
                </div>
              )}

              {/* Histórico do que já foi registrado nesta licitação */}
              {historico === null && <p className="dica-menus" style={{ marginTop: 8 }}>Carregando histórico...</p>}
              {historico && historico.length === 0 && (
                <p className="dica-menus" style={{ marginTop: 8 }}>Nenhum evento registrado nesta licitação ainda.</p>
              )}
              {historico && historico.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {historico.map(ev => {
                    const info = tipoEventoInfo(ev.tipoEvento)
                    return (
                      <div key={ev.id} style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                        padding: '7px 0', borderBottom: '1px solid #F1F5F9',
                      }}>
                        <span style={{ fontSize: 14 }}>{info.ico}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, color: '#2E2D2F', fontWeight: 600 }}>
                            {String(ev.data).split('-').reverse().join('/')}{ev.hora ? ' às ' + ev.hora : ''} — {info.nome.split('(')[0].trim()}
                          </div>
                          <div style={{ fontSize: 11.5, color: ev.descricao && ev.descricao !== info.nome ? '#374151' : '#94A3B8', marginTop: 2 }}>
                            <strong style={{ color: '#64748B' }}>Observação:</strong>{' '}
                            {ev.descricao && ev.descricao !== info.nome ? ev.descricao : 'sem observação'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
                  {(fase === 'Descartado'
                    ? RESULTADOS.filter(r => r.id === 'Nao participamos')
                    : RESULTADOS.filter(r => !['Aguardando', 'Nao participamos'].includes(r.id))
                  ).map(r => (
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
