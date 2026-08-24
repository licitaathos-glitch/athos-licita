'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { anexarArquivoPNCP } from '@/lib/anexoPncpClient'
import { useSearchParams } from 'next/navigation'
import { useApp } from '@/lib/AppContext'
import { UFS } from '@/lib/pncpComum'
import { enviarAoGAS, lerBase64 } from '@/lib/gasClient'
import ModalStatus from '@/components/ModalStatus'
import { nomeResultado, corResultado } from '@/lib/resultado'
import { exportarExcel, numero } from '@/lib/exportarExcel'
import ListaLicitacoes from '@/components/ListaLicitacoes'
import { FASES, normalizarFase } from '@/lib/fases'
import { STATUS_LIC, corStatus, nomeStatus } from '@/lib/statusLicitacao'

const MODAL_NOMES = ['Pregão Eletrônico', 'Pregão Presencial', 'Concorrência Eletrônica',
  'Concorrência Presencial', 'Dispensa', 'Inexigibilidade']

const brParaInput = v => {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2})?/)
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00:00'}` : ''
}
const inputParaBr = v => {
  if (!v) return ''
  const [d, h] = String(v).split('T')
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}${h ? ' ' + h : ''}` : ''
}
const PART = { Sim: 'pill-green', 'Não': 'pill-red', Pendente: 'pill-amber' }

function LicitacoesConteudo() {
  const { usuario, empresaAtual, empresas } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfil === 'empresa'

  const [lics, setLics] = useState(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [filtroFase, setFiltroFase] = useState('')
  const [filtroOrgao, setFiltroOrgao] = useState('')
  const [filtroData, setFiltroData] = useState('')
  const [editando, setEditando] = useState(null)
  const [modalStatus, setModalStatus] = useState(null)
  const [vista, setVista] = useState('fases')

  const params = useSearchParams()
  const idDaUrl = params.get('id')

  // Eventos e tarefas de todas as licitações, agrupados por licitação, para a
  // lista mostrar os registros embaixo de cada uma.
  const [registrosPorLic, setRegistrosPorLic] = useState({})
  useEffect(() => {
    Promise.all([
      fetch('/api/calendario/eventos').then(r => r.json()).catch(() => ({})),
      fetch('/api/tarefas').then(r => r.json()).catch(() => ({})),
    ]).then(([ev, tf]) => {
      const mapa = {}
      const juntar = r => {
        if (!r.licitacaoId) return
        ;(mapa[r.licitacaoId] = mapa[r.licitacaoId] || []).push(r)
      }
      ;(ev.sucesso ? ev.eventos : []).forEach(e => juntar({
        chave: 'e' + e.id, tipo: 'evento', tipoEvento: e.tipoEvento || '',
        data: e.data || '', hora: e.hora || '',
        titulo: (e.titulo || '').replace(/^\S+\s/, ''), obs: e.descricao || '',
        licitacaoId: String(e.licitacaoId || ''),
      }))
      ;(tf.sucesso ? tf.tarefas : []).forEach(t => juntar({
        chave: 't' + t.id, tipo: 'tarefa', tipoEvento: '',
        data: String(t.prazo || '').slice(0, 10), hora: String(t.prazo || '').slice(11, 16),
        titulo: t.titulo, obs: t.descricao || '', feita: t.status === 'Concluída',
        licitacaoId: String(t.licitacaoId || ''),
      }))
      Object.values(mapa).forEach(l => l.sort((a, b) => String(b.data + b.hora).localeCompare(String(a.data + a.hora))))
      setRegistrosPorLic(mapa)
    })
  }, [])

  const carregar = useCallback(() => {
    fetch('/api/licitacoes').then(r => r.json())
      .then(r => { r.sucesso ? setLics(r.licitacoes) : setErro(r.erro || 'Erro ao carregar.') })
      .catch(() => setErro('Erro de conexão.'))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!lics) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresaNome = empresaSel ? (empresas.find(e => String(e.id) === empresaSel)?.nome || '') : 'Todas as empresas'
  const base = empresaSel ? lics.filter(l => l.empresa_id === empresaSel) : lics

  // Data da licitação (para exibir e filtrar): usa a primeira que existir
  const dataDaLicISO = l => {
    const v = l.dataSessao || l.dataLimite || l.dataAbertura || ''
    const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
  }

  const orgaosDisponiveis = [...new Set(base.map(l => l.orgao).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const lista = base.filter(l => {
    if (status && (l.status || 'Aberta') !== status) return false
    if (filtroFase && normalizarFase(l.fase || 'Em analise') !== filtroFase) return false
    if (filtroOrgao && l.orgao !== filtroOrgao) return false
    if (filtroData && dataDaLicISO(l) !== filtroData) return false
    const q = busca.toLowerCase()
    if (q && ![l.objeto, l.orgao, l.uasg, l.numeroEdital, l.portal, l.uf].join(' ').toLowerCase().includes(q)) return false
    return true
  })

  const abertas = base.filter(l => l.status === 'Aberta').length
  const vaiParticipar = base.filter(l => l.participar === 'Sim').length

  async function moverFase(lic, novaFase) {
    // Atualização otimista: move na tela e grava em seguida
    setLics(atual => atual.map(l => l.id === lic.id ? { ...l, fase: novaFase } : l))
    const extras = {}
    if (novaFase === 'Descartado' && (!lic.resultado || lic.resultado === 'Aguardando')) {
      extras.participar = 'Não'
    }
    if (novaFase === 'Finalizada') extras.status = 'Encerrada'
    // Ao tirar de Finalizada/Descartado, limpa o desfecho — senão a licitação
    // volta sozinha para lá na próxima leitura e parece travada
    const eraFinal = ['Finalizada', 'Descartado'].includes(lic.fase)
    const virouAberta = !['Finalizada', 'Descartado'].includes(novaFase)
    if (eraFinal && virouAberta) {
      extras.resultado = 'Aguardando'
      extras.motivo = ''
      extras.status = 'Aberta'
      if (lic.participar === 'Não') extras.participar = 'Pendente'
    }
    const r = await fetch('/api/licitacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto, fase: novaFase, ...extras }),
    }).then(x => x.json())
    if (!r.sucesso) { alert(r.erro || 'Erro ao mover.'); carregar() }
    else if (novaFase === 'Finalizada' && (!lic.resultado || lic.resultado === 'Aguardando')) {
      setModalStatus({ ...lic, fase: novaFase })
    }
  }

  async function excluir(lic) {
    if (!confirm('Excluir definitivamente a licitação "' + (lic.numeroEdital || lic.objeto || '').slice(0, 60) + '"?\n\nEsta ação não pode ser desfeita.')) return
    const r = await fetch('/api/licitacoes', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lic.id }),
    }).then(x => x.json())
    if (r.sucesso) { setAberta(null); setModalStatus(null); carregar() }
    else alert(r.erro || 'Erro ao excluir.')
  }

  async function decidir(lic, valor) {
    const r = await fetch('/api/licitacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lic.id, empresa_id: lic.empresa_id, objeto: lic.objeto, participar: valor }),
    }).then(x => x.json())
    if (r.sucesso) carregar(); else alert(r.erro || 'Erro.')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Licitações</h2>
          <p className="sec-sub">{empresaNome}{somenteConsulta ? ' · modo consulta' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {perfil === 'adm' && (
            <a href="/dashboard/importar-licitacoes" className="btn-ghost">⬆ Importar planilha</a>
          )}
          {!somenteConsulta && empresaSel && (
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => setEditando({})}>+ Incluir licitação</button>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-val kv-navy">{base.length}</div><div className="kpi-label">Licitações salvas</div></div>
        <div className="kpi"><div className="kpi-val kv-green">{abertas}</div><div className="kpi-label">Abertas</div></div>
        <div className="kpi"><div className="kpi-val kv-amber">{vaiParticipar}</div><div className="kpi-label">Vamos participar</div></div>
      </div>

      {!empresaSel && !somenteConsulta && (
        <div className="aviso-box">Selecione uma empresa no menu lateral para incluir licitações.</div>
      )}

      <div className="filtro-bar">
        <input className="busca-input" placeholder="Buscar por objeto, órgão, edital, portal..." value={busca} onChange={e => setBusca(e.target.value)} />

        <select className="filtro-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_LIC.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>

        {vista === 'lista' && (
          <select className="filtro-select" value={filtroFase} onChange={e => setFiltroFase(e.target.value)}>
            <option value="">Todas as fases</option>
            {FASES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}

        <select className="filtro-select" value={filtroOrgao} onChange={e => setFiltroOrgao(e.target.value)}>
          <option value="">Todos os órgãos</option>
          {orgaosDisponiveis.map(o => <option key={o} value={o}>{o.length > 40 ? o.slice(0, 40) + '…' : o}</option>)}
        </select>

        <input type="date" className="filtro-data" value={filtroData} onChange={e => setFiltroData(e.target.value)}
          title="Data da licitação (sessão, limite ou abertura)" />

        {(status || filtroFase || filtroOrgao || filtroData || busca) && (
          <button className="iBtn" onClick={() => { setStatus(''); setFiltroFase(''); setFiltroOrgao(''); setFiltroData(''); setBusca('') }}>
            ✕ Limpar filtros
          </button>
        )}

        {/* Exporta a lista como ela está na tela — com os filtros aplicados */}
        <button className="iBtn" disabled={!lista.length} onClick={() => exportarExcel(
          lista.map(l => ({
            Edital: l.numeroEdital || '',
            'Nº PNCP': l.numeroPNCP || '',
            Empresa: l.empresa_nome || '',
            Órgão: l.orgao || '',
            UASG: l.uasg || '',
            UF: l.uf || '',
            Modalidade: l.modalidade || '',
            Portal: l.portal || '',
            SRP: l.srp || '',
            Objeto: l.objeto || '',
            'Valor estimado': numero(l.valor),
            Abertura: l.dataAbertura || '',
            'Limite da proposta': l.dataLimite || '',
            'Sessão de disputa': l.dataSessao || '',
            Fase: l.fase || '',
            Status: l.status || '',
            Resultado: nomeResultado(l.resultado) || '',
            'Nº proposta': l.numeroProposta || '',
            Itens: (l.itens || []).length,
            Observações: l.observacaoDisputa || '',
            Link: l.link || '',
          })),
          `Licitacoes ${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
          'Licitações',
        )}>⬇ Excel ({lista.length})</button>

        <div className="vista-toggle">
          <button className={vista === 'fases' ? 'on' : ''} onClick={() => setVista('fases')}>⊞ Por fase</button>
          <button className={vista === 'lista' ? 'on' : ''} onClick={() => setVista('lista')}>☰ Lista</button>
        </div>
      </div>

      {vista === 'fases' && (
        <ListaLicitacoes
          licitacoes={lista}
          somenteConsulta={somenteConsulta}
          onMover={moverFase}
          onStatus={setModalStatus}
          onEditar={setEditando}
          onExcluir={excluir}
          abrirId={idDaUrl}
          registrosPorLic={registrosPorLic}
        />
      )}

      {lista.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma licitação. Use Oportunidades para trazer do PNCP ou inclua manualmente.</div>}

      {vista === 'lista' && (
        <ListaLicitacoes
          licitacoes={lista}
          somenteConsulta={somenteConsulta}
          onMover={moverFase}
          onStatus={setModalStatus}
          onEditar={setEditando}
          onExcluir={excluir}
          abrirId={idDaUrl}
          registrosPorLic={registrosPorLic}
          planas
        />
      )}

      {modalStatus && (
        <ModalStatus lic={modalStatus} onFechar={() => setModalStatus(null)}
          onSalvo={() => { setModalStatus(null); carregar() }} />
      )}

      {editando && (
        <ModalLic lic={editando} empresaId={empresaSel || editando.empresa_id} empresaNome={empresaNome}
          onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar() }} />
      )}
    </div>
  )
}

function ModalLic({ lic, empresaId, empresaNome, onFechar, onSalvo }) {
  const ed = !!lic.id
  const [linkPncp, setLinkPncp] = useState('')
  const [extraindo, setExtraindo] = useState(false)
  const [f, setF] = useState({
    objeto: lic.objeto || '', numeroEdital: lic.numeroEdital || '', numeroPNCP: lic.numeroPNCP || '',
    modalidade: lic.modalidade || '', portal: lic.portal || '', uf: lic.uf || '', orgao: lic.orgao || '', uasg: lic.uasg || '',
    valor: lic.valor || '', dataAbertura: brParaInput(lic.dataAbertura), dataLimite: brParaInput(lic.dataLimite),
    dataSessao: brParaInput(lic.dataSessao),
    srp: lic.srp || 'Não', status: lic.status || 'Aberta', link: lic.link || '',
    anexoDriveId: lic.anexoDriveId || '', anexoDriveUrl: lic.anexoDriveUrl || '',
  })
  const [itens, setItens] = useState(lic.itens || [])
  const [buscaItemLic, setBuscaItemLic] = useState('')
  const [grupoAtual, setGrupoAtual] = useState('')
  const [portais, setPortais] = useState([])
  const [novoPortal, setNovoPortal] = useState('')
  const [buscandoItens, setBuscandoItens] = useState(false)
  const [buscandoAnexosPNCP, setBuscandoAnexosPNCP] = useState(false)
  const [anexos, setAnexos] = useState(() => {
    if (Array.isArray(lic.anexos) && lic.anexos.length) return lic.anexos
    return lic.anexoDriveUrl ? [{ nome: 'Edital', url: lic.anexoDriveUrl, id: lic.anexoDriveId || '' }] : []
  })
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [salvando, setSalvando] = useState(false)

  const set = (k, v) => setF(o => ({ ...o, [k]: v }))

  useEffect(() => {
    fetch('/api/portais').then(r => r.json())
      .then(r => { if (r.sucesso) setPortais(r.portais) })
      .catch(() => {})
  }, [])

  // Referência do processo no PNCP. O campo "Link do edital" é sobrescrito pelo
  // link do portal de origem (Comprasnet, BLL...) depois da extração, e uma
  // licitação salva pelas Oportunidades já nasce assim — por isso o nº de
  // controle PNCP vem antes dele.
  const refPNCP = () => (linkPncp.trim() || f.numeroPNCP?.trim() || f.link?.trim() || '')

  // Busca os itens no PNCP a partir da referência disponível
  async function importarItens() {
    const alvo = refPNCP()
    if (!alvo) { setErro('Informe o link do PNCP (ou o nº de controle PNCP) para importar os itens.'); return }
    setErro(''); setBuscandoItens(true)
    try {
      const r = await fetch('/api/licitacoes/extrair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: alvo }),
      }).then(x => x.json())
      if (!r.sucesso) setErro(r.erro || 'Não foi possível importar os itens.')
      else if (r.dados?.itens?.length) {
        setItens(numerar(r.dados.itens))
        setOk(r.dados.itens.length + ' itens importados do PNCP.')
      }
      else setErro('O PNCP não retornou itens para esta licitação. Inclua manualmente.')
    } catch { setErro('Erro de conexão.') }
    setBuscandoItens(false)
  }

  async function extrair() {
    const alvo = refPNCP()
    if (!alvo) { setErro('Cole o link do PNCP (ou preencha o nº de controle PNCP).'); return }
    setErro(''); setOk(''); setExtraindo(true)
    try {
      const r = await fetch('/api/licitacoes/extrair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: alvo }),
      }).then(x => x.json())
      if (!r.sucesso) setErro((r.erro || 'Não foi possível extrair.') + (r.detalhe?.length ? ' [' + r.detalhe.join(' · ') + ']' : ''))
      else {
        const d = r.dados
        setF(o => ({
          ...o,
          objeto: d.objeto || o.objeto, numeroEdital: d.numeroEdital || o.numeroEdital,
          numeroPNCP: d.numeroPNCP || o.numeroPNCP, modalidade: d.modalidade || o.modalidade,
          portal: d.portal || o.portal, uf: d.uf || o.uf, orgao: d.orgao || o.orgao, uasg: d.uasg || o.uasg,
          valor: d.valorEstimado ? 'R$ ' + Number(d.valorEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : o.valor,
          dataAbertura: d.dataAberturaISO || o.dataAbertura, dataLimite: d.dataLimiteISO || o.dataLimite,
          srp: d.srp || o.srp, link: d.link || o.link,
        }))
        if (d.itens?.length) setItens(numerar(d.itens))
        if (!d.itens?.length && d.diagItens?.length) {
          setErro('Dados carregados, mas o PNCP não devolveu itens. [' + d.diagItens.slice(0, 2).join(' · ') + ']')
        }
        setOk('Dados extraídos do PNCP — confira antes de salvar. Buscando os arquivos do edital...')
        buscarEAnexarPNCP(alvo)
      }
    } catch (e) { setErro('Erro de conexão: ' + (e && e.message ? e.message : 'desconhecido')) }
    setExtraindo(false)
  }

  // Depois de extrair os dados, tenta já trazer e anexar os documentos
  // publicados no PNCP sozinho — sem precisar esperar até o Andamento.
  async function buscarEAnexarPNCP(link) {
    setBuscandoAnexosPNCP(true)
    try {
      const r = await fetch('/api/licitacoes/arquivos-pncp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link }),
      }).then(x => x.json())
      if (!r.sucesso || !r.arquivos?.length) {
        setOk('Dados extraídos do PNCP — confira antes de salvar. Não encontrei documentos publicados para anexar sozinho; anexe manualmente se precisar.')
        setBuscandoAnexosPNCP(false)
        return
      }
      const enviados = []
      for (const a of r.arquivos) {
        try {
          const up = await anexarArquivoPNCP({
            url: a.url, nomeArquivo: a.nomeArquivo || a.titulo, empresaNome,
          })
          if (up.sucesso) enviados.push({ nome: up.nome || a.titulo, url: up.url, id: up.id })
        } catch {}
      }
      if (enviados.length) {
        setAnexos(l => {
          const todos = [...l, ...enviados]
          set('anexoDriveId', todos[0].id || '')
          set('anexoDriveUrl', todos[0].url || '')
          return todos
        })
        setOk(`Dados extraídos do PNCP — confira antes de salvar. ${enviados.length} arquivo(s) do edital já anexado(s) automaticamente.`)
      } else {
        setOk('Dados extraídos do PNCP — confira antes de salvar. Encontrei documentos, mas não consegui anexar sozinho; anexe manualmente se precisar.')
      }
    } catch {
      setOk('Dados extraídos do PNCP — confira antes de salvar. Não consegui buscar os arquivos automaticamente; anexe manualmente se precisar.')
    }
    setBuscandoAnexosPNCP(false)
  }

  async function onAnexo(e) {
    const arquivos = Array.from(e.target.files || [])
    if (!arquivos.length) return
    const grandes = arquivos.filter(a => a.size > 25 * 1024 * 1024)
    if (grandes.length) { setErro('Arquivo acima de 25 MB: ' + grandes.map(a => a.nome || a.name).join(', ')); return }

    setErro(''); setEnviandoAnexo(true)
    const enviados = []
    for (const file of arquivos) {
      try {
        const base64 = await lerBase64(file)
        const r = await enviarAoGAS({
          action: 'uploadAnexoEdital',
          base64, mimeType: file.type || 'application/pdf', nomeArquivo: file.name, empresaNome,
        })
        if (r.ok) enviados.push({ nome: file.name, url: r.driveFileUrl, id: r.driveFileId })
        else setErro('Falha em ' + file.name + ': ' + (r.erro || 'erro desconhecido'))
      } catch (ex) {
        setErro('Falha em ' + file.name + ': ' + ex.message)
      }
    }
    if (enviados.length) {
      setAnexos(l => {
        const todos = [...l, ...enviados]
        // mantém o primeiro arquivo também nos campos antigos, por compatibilidade
        set('anexoDriveId', todos[0].id || '')
        set('anexoDriveUrl', todos[0].url || '')
        return todos
      })
    }
    setEnviandoAnexo(false)
    e.target.value = ''
  }

  async function salvar() {
    if (!f.objeto.trim() && !f.numeroEdital.trim()) { setErro('Informe o objeto ou o nº do edital.'); return }
    setErro(''); setSalvando(true)
    try {
      const abertura = inputParaBr(f.dataAbertura)
      const limite = inputParaBr(f.dataLimite)
      // A "data da sessão" (disputa) do Pregão Eletrônico coincide com o
      // encerramento do prazo de propostas (Limite), não com a Abertura —
      // são momentos diferentes: a Abertura só marca quando começa a
      // aceitar propostas, às vezes dias/semanas antes da sessão em si.
      // Só sincroniza quando não houver uma data de sessão ajustada à mão
      // no Andamento (ex: negociaram um novo dia após um adiamento).
      // A data da sessão tem campo próprio no formulário: o que for digitado
      // ali manda. Em branco, vale o encerramento das propostas (é quando a
      // disputa do Pregão acontece) e, na falta dele, a abertura.
      const dataSessaoFinal = inputParaBr(f.dataSessao) || limite || abertura

      const r = await fetch('/api/licitacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lic.id || null, empresa_id: empresaId, ...f,
          dataAbertura: abertura, dataLimite: limite,
          dataSessao: dataSessaoFinal,
          itensJson: JSON.stringify(itens.filter(it => String(it.descricao || '').trim())),
          anexosJson: JSON.stringify(anexos),
          portal: f.portal === '__outro' ? (novoPortal.trim() || '') : f.portal,
          origem: linkPncp ? 'pncp' : 'manual',
        }),
      }).then(x => x.json())
      if (r.sucesso) {
        if (r.aviso) { setErro('⚠️ ' + r.aviso); setSalvando(false); return }
        onSalvo()
      } else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  // O PNCP manda numeroItem, mas nem todo órgão preenche. Quem vier sem número
  // recebe a posição na lista, senão a coluna fica cheia de buracos e a
  // conferência com o edital deixa de funcionar.
  // O PNCP NÃO expõe o lote como campo separado: quando a licitação é por
  // lote, o "item" publicado já é o próprio lote. Por isso o grupo quase sempre
  // volta vazio e precisa ser atribuído aqui. Estes dois atalhos evitam
  // digitar item por item numa licitação de centenas de linhas.
  const loteNaDescricao = txt => {
    const m = String(txt || '').match(/\b(?:lote|grupo)\s*[:nº°\-]*\s*(\d{1,3}|[IVX]{1,5})\b/i)
    return m ? m[1].toUpperCase() : ''
  }

  const numerar = lista => lista
    .map((it, i) => ({ ...it, numero: String(it.numero ?? '').trim() || String(i + 1) }))
    .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0))

  const setItem = (i, k, v) => setItens(a => a.map((it, j) => j === i ? { ...it, [k]: v } : it))

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal modal-lg">
        <div className="modal-hdr">
          <div>
            <div className="modal-hdr-sub">LICITAÇÃO</div>
            <div className="modal-hdr-title">{ed ? 'Editar licitação' : 'Incluir licitação'}</div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">
          <div className="pncp-box">
            <label className="mini-lbl" style={{ color: '#1E40AF' }}>🔗 PREENCHIMENTO AUTOMÁTICO — LINK DO PNCP</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={linkPncp} onChange={e => setLinkPncp(e.target.value)}
                placeholder={f.numeroPNCP ? 'Vazio = usa o nº PNCP ' + f.numeroPNCP : 'https://pncp.gov.br/app/editais/...'} />
              <button className="iBtn iBtn-up" style={{ flexShrink: 0, height: 36 }} onClick={extrair} disabled={extraindo}>
                {extraindo ? '...' : '🔍 Extrair'}
              </button>
            </div>
            {ok && <div style={{ marginTop: 8, fontSize: 12.5, color: '#166534', fontWeight: 600 }}>✅ {ok}</div>}
            {erro && <div className="l-err" style={{ marginTop: 8 }}>{erro}</div>}
          </div>

          <div className="form-sub"><label>OBJETO</label><textarea rows={3} value={f.objeto} onChange={e => set('objeto', e.target.value)} /></div>

          <div className="form-grid">
            <div><label className="mini-lbl">Nº DO EDITAL</label><input value={f.numeroEdital} onChange={e => set('numeroEdital', e.target.value)} /></div>
            <div><label className="mini-lbl">MODALIDADE</label>
              <select value={f.modalidade} onChange={e => set('modalidade', e.target.value)}>
                <option value="">Selecione</option>{MODAL_NOMES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="mini-lbl">PLATAFORMA DA DISPUTA</label>
              <select value={portais.some(p => p.nome === f.portal) || !f.portal ? f.portal : '__outro'}
                onChange={e => { if (e.target.value === '__outro') { setNovoPortal(f.portal || ''); set('portal', '__outro') } else set('portal', e.target.value) }}>
                <option value="">Selecione...</option>
                {portais.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                <option value="__outro">+ Outra plataforma...</option>
              </select>
              {(f.portal === '__outro' || (f.portal && !portais.some(p => p.nome === f.portal))) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input value={novoPortal} onChange={e => setNovoPortal(e.target.value)} placeholder="Nome da plataforma" />
                  <button className="iBtn" style={{ flexShrink: 0 }} onClick={async () => {
                    const nome = novoPortal.trim()
                    if (!nome) return
                    await fetch('/api/portais', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) })
                    const r = await fetch('/api/portais').then(x => x.json())
                    if (r.sucesso) setPortais(r.portais)
                    set('portal', nome); setNovoPortal('')
                  }}>Salvar</button>
                </div>
              )}
            </div>
            <div><label className="mini-lbl">UF</label>
              <select value={f.uf} onChange={e => set('uf', e.target.value)}>
                <option value="">Selecione</option>{UFS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="mini-lbl">ÓRGÃO</label><input value={f.orgao} onChange={e => set('orgao', e.target.value)} /></div>
            <div><label className="mini-lbl">UASG</label><input value={f.uasg} onChange={e => set('uasg', e.target.value)} placeholder="Código da UASG" /></div>
            <div><label className="mini-lbl">VALOR ESTIMADO</label><input value={f.valor} onChange={e => set('valor', e.target.value)} placeholder="R$ 0,00" /></div>
            <div><label className="mini-lbl">ABERTURA DAS PROPOSTAS</label><input type="datetime-local" value={f.dataAbertura} onChange={e => set('dataAbertura', e.target.value)} /></div>
            <div><label className="mini-lbl">LIMITE DA PROPOSTA</label><input type="datetime-local" value={f.dataLimite} onChange={e => set('dataLimite', e.target.value)} /></div>
            <div><label className="mini-lbl">DATA DA SESSÃO</label>
              <input type="datetime-local" value={f.dataSessao} onChange={e => set('dataSessao', e.target.value)} />
              <p className="dica-menus" style={{ margin: '2px 0 0' }}>Em branco, usa o limite da proposta</p>
            </div>
            <div><label className="mini-lbl">SRP</label>
              <select value={f.srp} onChange={e => set('srp', e.target.value)}><option>Não</option><option>Sim</option></select>
            </div>
            <div><label className="mini-lbl">STATUS</label>
              <select value={f.status} onChange={e => set('status', e.target.value)}>{STATUS_LIC.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
            </div>
          </div>

          <div className="form-sub"><label>LINK DO EDITAL</label><input value={f.link} onChange={e => set('link', e.target.value)} /></div>
          <p className="dica-menus" style={{ marginTop: -6 }}>
            📎 Depois de "Extrair", os documentos publicados no PNCP são buscados e anexados aqui automaticamente. Você também pode chamar a busca de novo pelo botão abaixo, ou anexar o arquivo você mesmo.
          </p>

          <div className="form-sub">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ margin: 0 }}>📎 ARQUIVOS (edital, termo de referência, anexos...)</label>
              {/* Mesmo botão da fase Em análise, disponível já no cadastro: dá
                  para trazer o edital do PNCP ou subir o arquivo manualmente. */}
              <button className="iBtn iBtn-up" disabled={buscandoAnexosPNCP}
                onClick={() => {
                  const ref = refPNCP()
                  if (!ref) { setErro('Cole o link do PNCP acima (ou preencha o nº PNCP) para buscar os arquivos.'); return }
                  setErro(''); buscarEAnexarPNCP(ref)
                }}>
                {buscandoAnexosPNCP ? 'Buscando...' : '📎 Extrair arquivos do edital'}
              </button>
            </div>
            {buscandoAnexosPNCP && (
              <p className="dica-menus" style={{ margin: '0 0 8px' }}>🔎 Buscando arquivos do edital no PNCP...</p>
            )}
            {anexos.map((a, i) => (
              <div className="anexo-item" key={i}>
                <a href={a.url} target="_blank" rel="noreferrer">📄 {a.nome}</a>
                <button className="iBtn iBtn-del" onClick={() => setAnexos(l => l.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <label className={'uz' + (enviandoAnexo ? ' uploading' : anexos.length ? ' success' : '')} style={{ padding: 16 }}>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" multiple onChange={onAnexo} disabled={enviandoAnexo} style={{ display: 'none' }} />
              {enviandoAnexo
                ? 'Enviando ao Drive...'
                : anexos.length
                  ? '➕ Adicionar mais arquivos'
                  : '📄 Clique para anexar (pode selecionar vários, até 25 MB cada)'}
            </label>
          </div>

          <div className="form-sub">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <label style={{ margin: 0 }}>ITENS DA LICITAÇÃO {itens.length > 0 && <span style={{ fontWeight: 400, color: '#94A3B8' }}>({itens.length})</span>}</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {itens.length > 3 && (
                  <input placeholder="🔍 Buscar item..." value={buscaItemLic} onChange={e => setBuscaItemLic(e.target.value)}
                    style={{ width: 160, padding: '6px 10px', fontSize: 12 }} />
                )}
                <input placeholder="Grupo/lote (opcional)" value={grupoAtual} onChange={e => setGrupoAtual(e.target.value)}
                  style={{ width: 150, padding: '6px 10px', fontSize: 12 }}
                  title="Preenchido nos próximos itens adicionados; use os botões ao lado para aplicar aos que já existem" />
                {grupoAtual.trim() && (
                  <button className="iBtn" title="Aplica o grupo digitado a todos os itens que estão aparecendo agora"
                    onClick={() => setItens(a => a.map(it =>
                      (!buscaItemLic || String(it.descricao || '').toLowerCase().includes(buscaItemLic.toLowerCase()))
                        ? { ...it, grupo: grupoAtual.trim() } : it))}>
                    aplicar a {itens.filter(it => !buscaItemLic || String(it.descricao || '').toLowerCase().includes(buscaItemLic.toLowerCase())).length} item(ns)
                  </button>
                )}
                <button className="iBtn" title="Procura 'Lote 3' / 'Grupo II' na descrição de cada item e preenche o grupo"
                  onClick={() => {
                    let achou = 0
                    setItens(a => a.map(it => {
                      const g = loteNaDescricao(it.descricao)
                      if (!g || it.grupo) return it
                      achou++
                      return { ...it, grupo: g }
                    }))
                    setOk(achou ? `Grupo preenchido em ${achou} item(ns) pela descrição.` : 'Nenhum item traz "lote" ou "grupo" na descrição.')
                  }}>🔎 Detectar lote</button>
                <button className="iBtn" onClick={importarItens} disabled={buscandoItens}>
                  {buscandoItens ? 'Importando...' : '⬇ Importar do PNCP'}
                </button>
                <button className="iBtn" onClick={() => setItens(a => [...a, {
                  numero: String(a.reduce((m, x) => Math.max(m, parseInt(x.numero) || 0), 0) + 1),
                  grupo: grupoAtual, descricao: '', quantidade: '', unidade: 'UN', valorUnitarioRef: '',
                }])}>+ Item</button>
              </div>
            </div>
            {itens.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8', padding: 8, textAlign: 'center', background: '#F8FAFC', borderRadius: 8 }}>Nenhum item. Em licitações por grupo, preencha "Grupo/lote" acima antes de adicionar os itens daquele grupo.</div>}
            {itens.length > 0 && (
              <div className="item-row-lic item-row-lic-hdr">
                <span>Nº</span><span>Grupo</span><span>Descrição</span><span>Qtd</span><span>UN</span><span>Vl. unit.</span><span></span>
              </div>
            )}
            {itens.map((it, i) => (!buscaItemLic || String(it.descricao || '').toLowerCase().includes(buscaItemLic.toLowerCase())) && (
              <div className="item-row-lic" key={i}>
                <input placeholder="Nº" value={it.numero ?? ''} onChange={e => setItem(i, 'numero', e.target.value)} />
                <input placeholder="Grupo" value={it.grupo || ''} onChange={e => setItem(i, 'grupo', e.target.value)} />
                <input placeholder="Descrição" value={it.descricao || ''} onChange={e => setItem(i, 'descricao', e.target.value)} />
                <input placeholder="Qtd" type="number" value={it.quantidade || ''} onChange={e => setItem(i, 'quantidade', e.target.value)} />
                <input placeholder="UN" value={it.unidade || ''} onChange={e => setItem(i, 'unidade', e.target.value)} />
                <input placeholder="Vl. unit." type="number" step="0.01" value={it.valorUnitarioRef || ''} onChange={e => setItem(i, 'valorUnitarioRef', e.target.value)} />
                <button className="iBtn iBtn-del" onClick={() => setItens(a => a.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>

          {erro && <div className="l-err" style={{ marginTop: 12 }}>{erro}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar licitação'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LicitacoesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>}>
      <LicitacoesConteudo />
    </Suspense>
  )
}
