'use client'
import { useState, useEffect } from 'react'
import { FASES, normalizarFase } from '@/lib/fases'
import { nomeResultado, corResultado } from '@/lib/resultado'
import { corStatus, nomeStatus } from '@/lib/statusLicitacao'

// Selo do fluxo de cotacao mostrado ao lado do numero do edital
const SELO_COTACAO = {
  pendente: {
    texto: '⏳ Cotação', classe: 'pill-amber',
    ajuda: l => `${l.cotacoesPendentes} de ${l.cotacoesTotal} pedido(s) de cotação sem resposta do fornecedor`,
  },
  respondida: {
    texto: '📥 Cotação respondida', classe: 'pill-blue',
    ajuda: () => 'Fornecedor respondeu — falta aceitar os preços e lançar no valor mínimo dos itens',
  },
  precificada: {
    texto: '✅ Preço cadastrado', classe: 'pill-green',
    ajuda: () => 'Todos os itens participando já têm valor mínimo definido',
  },
}
import ModalDetalheLicitacao from '@/components/ModalDetalheLicitacao'

function diasAte(v) {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  const d = new Date(+m[3], +m[2] - 1, +m[1])
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return Math.ceil((d - h) / 86400000)
}

// Transforma "dd/mm/aaaa hh:mm" em algo comparável (aaaammddhhmm); sem data
// vai pro fim da lista em ordem crescente e pro início em decrescente.
function chaveData(v) {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
  if (!m) return null
  return `${m[3]}${m[2]}${m[1]}${m[4] || '00'}${m[5] || '00'}`
}

function valorNumero(v) {
  return Number(String(v || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0
}

const COLUNAS_ORDENAVEIS = {
  sessao: { rotulo: 'Data da sessão', chave: l => chaveData(l.dataSessao || l.dataLimite || l.dataAbertura) },
  valor: { rotulo: 'Valor estimado', chave: l => valorNumero(l.valor) },
  itens: { rotulo: 'Itens', chave: l => l.itens?.length || 0 },
}

// Visão em abas por fase: os processos só aparecem depois de escolher a fase.
// A visão "Lista" (todas as fases juntas) usa o mesmo componente de linha,
// em grade fixa — colunas sempre alinhadas, sem quebra de margem.
export default function ListaLicitacoes({
  licitacoes, somenteConsulta, onMover, onStatus, onEditar, onExcluir,
  planas = false, // true = mostra tudo junto, sem abas (usada pela visão "Lista")
  abrirId = null, // vindo do calendário: já abre essa licitação direto, sem passar pela lista
}) {
  const [faseAtiva, setFaseAtiva] = useState(FASES[0].id)
  const [aberta, setAberta] = useState(null)
  // Ordenação estilo Excel: clica na coluna, alterna crescente/decrescente.
  // Padrão pedido: data da sessão, da mais próxima pra mais distante.
  const [ordenarPor, setOrdenarPor] = useState('sessao')
  const [ordemAsc, setOrdemAsc] = useState(true)

  function clicarColuna(campo) {
    if (ordenarPor === campo) setOrdemAsc(a => !a)
    else { setOrdenarPor(campo); setOrdemAsc(true) }
  }

  // Vindo do calendário (clique num evento de sessão/prazo/evento manual):
  // abre a licitação direto, já na aba da fase certa.
  useEffect(() => {
    if (!abrirId) return
    setAberta(abrirId)
    const l = licitacoes.find(x => x.id === abrirId)
    if (l) setFaseAtiva(normalizarFase(l.fase || 'Em analise'))
  }, [abrirId]) // eslint-disable-line react-hooks/exhaustive-deps

  const porFase = {}
  FASES.forEach(f => { porFase[f.id] = [] })
  licitacoes.forEach(l => {
    const f = normalizarFase(l.fase || 'Em analise')
    if (porFase[f]) porFase[f].push(l)
  })

  const chaveOrdem = COLUNAS_ORDENAVEIS[ordenarPor]?.chave || COLUNAS_ORDENAVEIS.sessao.chave
  function ordenar(lista) {
    return [...lista].sort((a, b) => {
      const va = chaveOrdem(a), vb = chaveOrdem(b)
      const aVazio = va === null || va === undefined || va === ''
      const bVazio = vb === null || vb === undefined || vb === ''
      if (aVazio && bVazio) return 0
      if (aVazio) return 1 // sem data/valor sempre no fim, nas duas ordens
      if (bVazio) return -1
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return ordemAsc ? cmp : -cmp
    })
  }

  const listaAtual = ordenar(planas ? licitacoes : (porFase[faseAtiva] || []))

  return (
    <div>
      {!planas && (
        <div className="abas-fase">
          {FASES.map(f => (
            <button key={f.id}
              className={'aba-fase' + (faseAtiva === f.id ? ' on' : '')}
              style={faseAtiva === f.id ? { borderBottomColor: f.cor } : undefined}
              onClick={() => setFaseAtiva(f.id)}>
              {f.nome}
              <span className="aba-cont" style={{ background: f.cor }}>{porFase[f.id].length}</span>
            </button>
          ))}
        </div>
      )}

      {listaAtual.length === 0 && (
        <div style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0' }}>
          Nenhuma licitação {planas ? 'para exibir' : 'nesta fase'}.
        </div>
      )}

      {listaAtual.length > 0 && (
        <div className="lic-grid-header">
          <span>Edital / Objeto</span>
          {['sessao', 'valor', 'itens'].map(campo => (
            <span key={campo} className="lg-col-ord" onClick={() => clicarColuna(campo)} title="Ordenar">
              {COLUNAS_ORDENAVEIS[campo].rotulo}
              <span className="lg-ord-seta">{ordenarPor === campo ? (ordemAsc ? ' ▲' : ' ▼') : ''}</span>
            </span>
          ))}
          <span>Fase</span>
          <span>Status</span>
        </div>
      )}

      {listaAtual.map(l => {
        const fx = FASES.find(f => f.id === normalizarFase(l.fase || 'Em analise')) || FASES[0]
        const st = l.status || 'Aberta'
        const dd = diasAte(l.dataSessao || l.dataLimite)
        const urgente = dd !== null && dd >= 0 && dd <= 3 && !['Finalizada', 'Descartado'].includes(fx.id)
        return (
          <div key={l.id}>
            <div className="lic-grid-row" style={{ borderLeftColor: fx.cor }} onClick={() => setAberta(aberta === l.id ? null : l.id)}>
              <div className="lg-col1">
                <div className="lic-num">
                  {l.numeroEdital || 'Sem nº'}
                  {l.srp === 'Sim' && <span className="pill pill-gray" style={{ marginLeft: 6 }}>SRP</span>}
                  {/* Etapa do pedido de cotacao ao fornecedor */}
                  {SELO_COTACAO[l.cotacaoEtapa] && (
                    <span
                      className={'pill ' + SELO_COTACAO[l.cotacaoEtapa].classe}
                      style={{ marginLeft: 6 }}
                      title={SELO_COTACAO[l.cotacaoEtapa].ajuda(l)}
                    >
                      {SELO_COTACAO[l.cotacaoEtapa].texto}
                      {l.cotacaoEtapa === 'pendente' && l.cotacoesPendentes > 1 ? ` (${l.cotacoesPendentes})` : ''}
                    </span>
                  )}
                </div>
                <div className="lic-obj">{l.objeto}</div>
                <div className="lic-meta">
                  {l.empresa_nome}{l.orgao ? ' · ' + l.orgao : ''}{l.uasg ? ' · UASG ' + l.uasg : ''}{l.uf ? '/' + l.uf : ''}
                  {l.modalidade ? ' · ' + l.modalidade : ''}{l.portal ? ' · ' + l.portal : ''}
                </div>
                {l.observacaoDisputa && (
                  <div className="lic-obs" title={l.observacaoDisputa}>📝 {l.observacaoDisputa}</div>
                )}
              </div>

              <div className="lg-col" style={urgente ? { color: '#DC2626', fontWeight: 700 } : undefined}>
                {l.dataSessao || l.dataLimite || l.dataAbertura || '—'}
                {urgente && <div style={{ fontSize: 10.5 }}>{dd === 0 ? 'hoje' : dd + 'd'}</div>}
              </div>

              <div className="lg-col">{l.valor || '—'}</div>

              <div className="lg-col">{l.itens?.length || 0}</div>

              <div className="lg-col">
                <span className="pill" style={{ background: fx.cor + '22', color: fx.cor }}>{fx.nome}</span>
              </div>

              <div className="lg-col">
                <span className="pill" style={{ background: corStatus(st) + '22', color: corStatus(st) }}>{nomeStatus(st)}</span>
                {l.resultado && l.resultado !== 'Aguardando' && (
                  <span className="pill" style={{ background: corResultado(l.resultado) + '22', color: corResultado(l.resultado), marginTop: 4 }}>
                    {nomeResultado(l.resultado)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {aberta && (() => {
        const l = listaAtual.find(x => x.id === aberta) || licitacoes.find(x => x.id === aberta)
        if (!l) return null
        const fx = FASES.find(f => f.id === normalizarFase(l.fase || 'Em analise')) || FASES[0]
        return (
          <ModalDetalheLicitacao
            lic={l} fx={fx} somenteConsulta={somenteConsulta}
            onMover={(lic, novaFase) => { onMover(lic, novaFase); setAberta(null) }}
            onStatus={l2 => { onStatus(l2); setAberta(null) }}
            onEditar={l2 => { onEditar(l2); setAberta(null) }}
            onExcluir={l2 => { onExcluir(l2); setAberta(null) }}
            onFechar={() => setAberta(null)}
          />
        )
      })()}
    </div>
  )
}
