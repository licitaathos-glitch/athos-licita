'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useApp } from '@/lib/AppContext'
import { faseDe } from '@/lib/fases'
import { tipoEventoInfo } from '@/lib/tiposEvento'
import ModalNovoRegistro from './ModalNovoRegistro'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const TIPOS = {
  proposta:  { rotulo: 'Prazo de proposta', cor: '#1D4ED8', bg: '#EFF6FF', ico: '⚡', href: '/dashboard/licitacoes' },
  sessao:    { rotulo: 'Sessão de disputa', cor: '#7C3AED', bg: '#F5F3FF', ico: '🎯', href: '/dashboard/licitacoes' },
  certidao:  { rotulo: 'Vencimento de certidão', cor: '#B45309', bg: '#FFFBEB', ico: '📋', href: '/dashboard/certidoes' },
  ata:       { rotulo: 'Vencimento de ata', cor: '#0F766E', bg: '#F0FDFA', ico: '🗂️', href: '/dashboard/atas' },
  pagamento: { rotulo: 'Previsão de pagamento', cor: '#15803D', bg: '#F0FDF4', ico: '💰', href: '/dashboard/financeiro' },
  manual:    { rotulo: 'Evento', cor: '#9333EA', bg: '#F5F3FF', ico: '📌', href: '' },
  tarefa:    { rotulo: 'Tarefa', cor: '#0369A1', bg: '#F0F9FF', ico: '✔️', href: '/dashboard' },
}

const parseBR = v => {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const diasEntre = iso => {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return Math.ceil((d - h) / 86400000)
}

export default function CalendarioGeral({ compacto = false }) {
  const { empresaAtual, empresas } = useApp()
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [visiveis, setVisiveis] = useState(Object.keys(TIPOS))
  const [diaAberto, setDiaAberto] = useState(null)
  const [modalEvento, setModalEvento] = useState(null)
  // Criar passa pelo modal unificado (tarefa ou evento); o ModalEvento antigo
  // fica só para editar/excluir um evento que já existe.
  const [novoRegistro, setNovoRegistro] = useState(null) // null=fechado; {}=novo; {data}=novo com data; objeto completo=editar

  const carregar = useCallback(() => {
    Promise.all([
      fetch('/api/licitacoes').then(r => r.json()),
      fetch('/api/certidoes').then(r => r.json()),
      fetch('/api/atas').then(r => r.json()),
      fetch('/api/empenhos').then(r => r.json()),
      fetch('/api/calendario/eventos').then(r => r.json()),
      fetch('/api/tarefas').then(r => r.json()),
    ]).then(([l, c, a, e, ev, tf]) => {
      setDados({
        lics: l.sucesso ? l.licitacoes : [],
        certidoes: c.sucesso ? c.certidoes : [],
        atas: a.sucesso ? a.atas : [],
        empenhos: e.sucesso ? e.empenhos : [],
        manuais: ev.sucesso ? ev.eventos : [],
        tarefas: tf.sucesso ? tf.tarefas : [],
      })
    }).catch(() => setErro('Erro de conexão.'))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : null
  const empresaNome = empresaSel ? (empresas.find(e => String(e.id) === empresaSel)?.nome || '') : 'Todas as empresas'

  // Monta a lista única de eventos
  const eventos = useMemo(() => {
    if (!dados) return []
    const ev = []
    const filtra = x => !empresaSel || x.empresa_id === empresaSel

    dados.lics.filter(filtra).forEach(l => {
      if (['Finalizada', 'Descartado'].includes(l.fase)) return
      const dl = parseBR(l.dataLimite)
      if (dl) ev.push({ id: l.id, data: dl, tipo: 'proposta', titulo: l.numeroEdital || 'Licitação',
        detalhe: String(l.objeto || '').slice(0, 90), extra: l.orgao, empresa: l.empresa_nome,
        badge: faseDe(l.fase).nome, link: l.link })
      const da = parseBR(l.dataAbertura)
      if (da && da !== dl) ev.push({ id: l.id, data: da, tipo: 'sessao', titulo: l.numeroEdital || 'Licitação',
        detalhe: String(l.objeto || '').slice(0, 90), extra: l.orgao, empresa: l.empresa_nome,
        badge: faseDe(l.fase).nome, link: l.link })
    })

    dados.certidoes.filter(filtra).forEach(c => {
      const d = parseBR(c.validade)
      if (d) ev.push({ data: d, tipo: 'certidao', titulo: c.tipo,
        detalhe: c.observacao || '', extra: c.empresa_nome, empresa: c.empresa_nome, link: c.link })
    })

    dados.atas.filter(filtra).forEach(a => {
      const d = parseBR(a.vencimento)
      if (d) ev.push({ data: d, tipo: 'ata', titulo: 'Ata ' + a.numeroAta,
        detalhe: String(a.objeto || '').slice(0, 90), extra: a.orgao, empresa: a.empresa_nome })
    })

    dados.empenhos.filter(filtra).forEach(e => {
      if (e.status === 'Pago' || e.status === 'Cancelado') return
      const d = parseBR(e.dataPagamento)
      if (d) ev.push({ data: d, tipo: 'pagamento', titulo: 'NE ' + e.numeroEmpenho,
        detalhe: e.itemDescricao || '', extra: e.orgao, empresa: e.empresa_nome,
        badge: 'R$ ' + (e.faturamento || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) })
    })

    ;(dados.manuais || []).filter(m => !empresaSel || !m.empresaId || m.empresaId === empresaSel).forEach(m => {
      if (m.data) ev.push({
        id: m.id, data: m.data, tipo: 'manual', titulo: m.titulo,
        // Hora e observação lado a lado: era o que faltava para o registro
        // dizer alguma coisa sem precisar abrir
        detalhe: [m.hora ? '🕐 ' + m.hora : '', m.descricao || ''].filter(Boolean).join(' · '),
        empresa: m.empresaNome, manual: m, licitacaoId: m.licitacaoId || '' })
    })

    // Tarefas com prazo entram como compromisso do dia. Sem prazo não têm
    // lugar no calendário — ficam só na lista de tarefas.
    ;(dados.tarefas || []).filter(t => !empresaSel || !t.empresaId || t.empresaId === empresaSel).forEach(t => {
      const dia = String(t.prazo || '').slice(0, 10)
      if (!dia) return
      const hora = String(t.prazo || '').slice(11, 16)
      ev.push({
        id: t.id, data: dia, tipo: 'tarefa',
        titulo: t.titulo,
        detalhe: [hora, t.prioridade !== 'Normal' ? 'prioridade ' + t.prioridade.toLowerCase() : ''].filter(Boolean).join(' · '),
        empresa: t.empresaNome,
        badge: t.status === 'Concluída' ? '✅ feita' : '',
        concluida: t.status === 'Concluída',
        licitacaoId: t.licitacaoId || '',
      })
    })

    return ev.filter(e => visiveis.includes(e.tipo))
  }, [dados, empresaSel, visiveis])

  const porDia = useMemo(() => {
    const m = {}
    eventos.forEach(e => { (m[e.data] = m[e.data] || []).push(e) })
    return m
  }, [eventos])

  const proximos = useMemo(() => {
    const h = hojeISO()
    return eventos.filter(e => e.data >= h).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 12)
  }, [eventos])

  // O que aconteceu nos últimos dias — para "o que eu fiz/o que venceu
  // recentemente", sem precisar navegar mês a mês pra trás
  const recentes = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const limite = new Date(hoje); limite.setDate(limite.getDate() - 6)
    const limiteISO = limite.toISOString().slice(0, 10)
    const h = hojeISO()
    return eventos.filter(e => e.data < h && e.data >= limiteISO).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10)
  }, [eventos])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  // Grade do mês
  const primeiro = new Date(ano, mes, 1)
  const ultimoDia = new Date(ano, mes + 1, 0).getDate()
  const inicioSemana = primeiro.getDay()
  const celulas = []
  for (let i = 0; i < inicioSemana; i++) celulas.push(null)
  for (let d = 1; d <= ultimoDia; d++) celulas.push(d)
  while (celulas.length % 7 !== 0) celulas.push(null)

  const navegar = passo => {
    let m = mes + passo, a = ano
    if (m > 11) { m = 0; a++ }
    if (m < 0) { m = 11; a-- }
    setMes(m); setAno(a); setDiaAberto(null)
  }

  const chaveDia = d => `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const hojeStr = hojeISO()

  const contagem = {}
  Object.keys(TIPOS).forEach(t => { contagem[t] = eventos.filter(e => e.tipo === t).length })

  return (
    <div>
      <h2 className="sec-title">Calendário e Alertas</h2>
      <p className="sec-sub">{empresaNome} · prazos de proposta, sessões, certidões, atas e recebimentos</p>

      <div className="legenda-cal">
        {Object.entries(TIPOS).map(([k, t]) => (
          <button key={k} className={'leg-item' + (visiveis.includes(k) ? ' on' : '')}
            style={visiveis.includes(k) ? { background: t.bg, color: t.cor, borderColor: t.cor } : {}}
            onClick={() => setVisiveis(v => v.includes(k) ? v.filter(x => x !== k) : [...v, k])}>
            {t.ico} {t.rotulo} <strong>{contagem[k]}</strong>
          </button>
        ))}
      </div>

      <div className="cal-wrap">
        <div className="cal-header">
          <button className="cal-nav" onClick={() => navegar(-1)}>‹</button>
          <div className="cal-title">{MESES[mes]} {ano}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="cal-nav" onClick={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()) }}>hoje</button>
            <button className="cal-nav" onClick={() => navegar(1)}>›</button>
          </div>
        </div>

        <div style={{ padding: '8px 14px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="iBtn iBtn-up" onClick={() => setNovoRegistro({ data: hojeStr })}>+ Nova tarefa ou evento</button>
        </div>

        <div className="cal-grid">
          {DOW.map(d => <div className="cal-dow" key={d}>{d}</div>)}
        </div>

        <div className="cal-grid">
          {celulas.map((d, i) => {
            if (!d) return <div className="cal-day vazio" key={i} />
            const chave = chaveDia(d)
            const evs = porDia[chave] || []
            return (
              <div className={'cal-day' + (chave === hojeStr ? ' hoje' : '') + (diaAberto === chave ? ' sel' : '')}
                key={i} onClick={() => evs.length && setDiaAberto(diaAberto === chave ? null : chave)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="cal-num">{d}</div>
                  <button className="cal-add" title="Novo evento neste dia"
                    onClick={ev => { ev.stopPropagation(); setNovoRegistro({ data: chave }) }}>+</button>
                </div>
                {evs.slice(0, 3).map((e, j) => (
                  <div className="cal-ev" key={j} style={{ background: TIPOS[e.tipo].bg, color: TIPOS[e.tipo].cor, cursor: 'pointer' }}
                    onClick={ev => {
                      ev.stopPropagation()
                      if (e.tipo === 'manual' && !e.licitacaoId) setModalEvento(e.manual)
                      else if (e.tipo === 'manual') window.location.href = '/dashboard/licitacoes?id=' + e.licitacaoId
                      else window.location.href = TIPOS[e.tipo].href + (e.id ? '?id=' + e.id : '')
                    }}
                    title={(e.empresa ? e.empresa + ' — ' : '') + e.titulo + (e.extra ? ' — ' + e.extra : '')}>
                    {TIPOS[e.tipo].ico} {e.titulo}
                  </div>
                ))}
                {evs.length > 3 && <div className="cal-mais">+{evs.length - 3}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {diaAberto && (
        <div className="detalhe-card" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ color: '#145653' }}>
              {diaAberto.split('-').reverse().join('/')} — {(porDia[diaAberto] || []).length} compromisso(s)
            </strong>
            <button className="iBtn" onClick={() => setDiaAberto(null)}>fechar</button>
          </div>
          {(porDia[diaAberto] || []).map((e, i) => <LinhaEvento e={e} key={i} onEditarManual={setModalEvento} />)}
        </div>
      )}

      {recentes.length > 0 && (
        <>
          <div style={{ margin: '22px 0 12px', fontSize: 14, fontWeight: 700, color: '#145653' }}>
            🕓 Últimos dias
          </div>
          {recentes.map((e, i) => <LinhaEvento e={e} key={i} mostrarData onEditarManual={setModalEvento} />)}
        </>
      )}

      <div style={{ margin: '22px 0 12px', fontSize: 14, fontWeight: 700, color: '#145653' }}>
        ⏰ Próximos compromissos
      </div>
      {proximos.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Nada nos próximos dias.</div>}
      {proximos.map((e, i) => <LinhaEvento e={e} key={i} mostrarData onEditarManual={setModalEvento} />)}

      {novoRegistro && (
        <ModalNovoRegistro
          dataInicial={novoRegistro.data}
          empresaId={empresaAtual !== 'todas' ? String(empresaAtual) : ''}
          onFechar={() => setNovoRegistro(null)}
          onSalvo={carregar} />
      )}

      {modalEvento && (
        <ModalEvento
          evento={modalEvento} empresas={empresas} empresaAtual={empresaAtual}
          onFechar={() => setModalEvento(null)}
          onSalvo={() => { setModalEvento(null); carregar() }}
        />
      )}
    </div>
  )
}

function LinhaEvento({ e, mostrarData, onEditarManual }) {
  const t = TIPOS[e.tipo]
  const icone = e.manual?.tipoEvento ? tipoEventoInfo(e.manual.tipoEvento).ico : t.ico
  const dd = diasEntre(e.data)
  const urgente = dd !== null && dd >= 0 && dd <= 3
  const textoPrazo = dd === null ? '' : dd === 0 ? 'hoje' : dd === 1 ? 'amanhã' : dd === -1 ? 'ontem'
    : dd < 0 ? `há ${Math.abs(dd)}d` : `em ${dd}d`
  return (
    <div className="ev-linha" style={{ borderLeftColor: t.cor, opacity: e.concluida ? .5 : 1 }}>
      <span className="ev-ico" style={{ background: t.bg }}>{icone}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ev-titulo" style={{ textDecoration: e.concluida ? 'line-through' : 'none' }}>
          {e.empresa && <span className="ev-empresa-chip">{e.empresa}</span>}
          {e.titulo}
        </div>
        {e.detalhe && <div className="ev-detalhe">{e.detalhe}</div>}
        <div className="ev-meta">
          {t.rotulo}{e.extra ? ' · ' + e.extra : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
        {e.badge && <span className="pill pill-gray">{e.badge}</span>}
        {mostrarData && (
          <span className={'ev-prazo' + (urgente ? ' urg' : '')}>{textoPrazo}</span>
        )}
        {e.tipo === 'manual'
          ? (e.licitacaoId
              ? <Link href={'/dashboard/licitacoes?id=' + e.licitacaoId} className="iBtn">📄 abrir licitação</Link>
              : <button className="iBtn" onClick={() => onEditarManual(e.manual)}>editar</button>)
          : <Link href={t.href + (e.id ? '?id=' + e.id : '')} className="iBtn">abrir</Link>}
      </div>
    </div>
  )
}

function ModalEvento({ evento, empresas, empresaAtual, onFechar, onSalvo }) {
  const ed = !!evento.id
  const [titulo, setTitulo] = useState(evento.titulo || '')
  const [data, setData] = useState(evento.data || '')
  const [hora, setHora] = useState(evento.hora || '')
  const [empresaId, setEmpresaId] = useState(evento.empresaId || (empresaAtual !== 'todas' ? String(empresaAtual) : ''))
  const [descricao, setDescricao] = useState(evento.descricao || '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  async function salvar() {
    if (!titulo.trim() || !data) { setErro('Título e data são obrigatórios.'); return }
    setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/calendario/eventos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evento.id || null, empresaId: empresaId || '', titulo, data, hora, descricao, tipoEvento: evento.tipoEvento || '' }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo(); else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  async function excluir() {
    if (!confirm('Excluir este evento?')) return
    setExcluindo(true)
    try {
      const r = await fetch('/api/calendario/eventos', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evento.id }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo(); else setErro(r.erro || 'Erro ao excluir.')
    } catch { setErro('Erro de conexão.') }
    setExcluindo(false)
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal">
        <div className="modal-hdr">
          <div><div className="modal-hdr-sub">CALENDÁRIO</div><div className="modal-hdr-title">{ed ? 'Editar evento' : 'Novo evento'}</div></div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-sub"><label>TÍTULO</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Reunião com o órgão, prazo interno..." /></div>
          <div className="filtro-linha">
            <div style={{ minWidth: 160 }}><label className="mini-lbl">DATA</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} /></div>
            <div style={{ minWidth: 120 }}><label className="mini-lbl">HORA (opcional)</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} /></div>
          </div>
          <div className="form-sub"><label>EMPRESA (opcional)</label>
            <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}>
              <option value="">Todas as empresas</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="form-sub"><label>DESCRIÇÃO (opcional)</label>
            <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} /></div>
          {erro && <div className="l-err">{erro}</div>}
        </div>
        <div className="modal-foot">
          {ed && <button className="iBtn iBtn-del" onClick={excluir} disabled={excluindo}>{excluindo ? 'Excluindo...' : '🗑 Excluir'}</button>}
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar evento'}</button>
        </div>
      </div>
    </div>
  )
}
