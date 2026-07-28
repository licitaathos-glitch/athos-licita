'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useApp } from '@/lib/AppContext'
import { faseDe } from '@/lib/fases'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const TIPOS = {
  proposta:  { rotulo: 'Prazo de proposta', cor: '#1D4ED8', bg: '#EFF6FF', ico: '⚡', href: '/dashboard/licitacoes' },
  sessao:    { rotulo: 'Sessão de disputa', cor: '#7C3AED', bg: '#F5F3FF', ico: '🎯', href: '/dashboard/licitacoes' },
  certidao:  { rotulo: 'Vencimento de certidão', cor: '#B45309', bg: '#FFFBEB', ico: '📋', href: '/dashboard/certidoes' },
  ata:       { rotulo: 'Vencimento de ata', cor: '#0F766E', bg: '#F0FDFA', ico: '🗂️', href: '/dashboard/atas' },
  pagamento: { rotulo: 'Previsão de pagamento', cor: '#15803D', bg: '#F0FDF4', ico: '💰', href: '/dashboard/financeiro' },
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

export default function CalendarioPage() {
  const { empresaAtual, empresas } = useApp()
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [visiveis, setVisiveis] = useState(Object.keys(TIPOS))
  const [diaAberto, setDiaAberto] = useState(null)

  const carregar = useCallback(() => {
    Promise.all([
      fetch('/api/licitacoes').then(r => r.json()),
      fetch('/api/certidoes').then(r => r.json()),
      fetch('/api/atas').then(r => r.json()),
      fetch('/api/empenhos').then(r => r.json()),
    ]).then(([l, c, a, e]) => {
      setDados({
        lics: l.sucesso ? l.licitacoes : [],
        certidoes: c.sucesso ? c.certidoes : [],
        atas: a.sucesso ? a.atas : [],
        empenhos: e.sucesso ? e.empenhos : [],
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
      if (dl) ev.push({ data: dl, tipo: 'proposta', titulo: l.numeroEdital || 'Licitação',
        detalhe: String(l.objeto || '').slice(0, 90), extra: l.orgao, empresa: l.empresa_nome,
        badge: faseDe(l.fase).nome, link: l.link })
      const da = parseBR(l.dataAbertura)
      if (da && da !== dl) ev.push({ data: da, tipo: 'sessao', titulo: l.numeroEdital || 'Licitação',
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
                <div className="cal-num">{d}</div>
                {evs.slice(0, 3).map((e, j) => (
                  <div className="cal-ev" key={j} style={{ background: TIPOS[e.tipo].bg, color: TIPOS[e.tipo].cor }}
                    title={e.titulo + ' — ' + (e.extra || '')}>
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
          {(porDia[diaAberto] || []).map((e, i) => <LinhaEvento e={e} key={i} />)}
        </div>
      )}

      <div style={{ margin: '22px 0 12px', fontSize: 14, fontWeight: 700, color: '#145653' }}>
        ⏰ Próximos compromissos
      </div>
      {proximos.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Nada nos próximos dias.</div>}
      {proximos.map((e, i) => <LinhaEvento e={e} key={i} mostrarData />)}
    </div>
  )
}

function LinhaEvento({ e, mostrarData }) {
  const t = TIPOS[e.tipo]
  const dd = diasEntre(e.data)
  const urgente = dd !== null && dd <= 3
  return (
    <div className="ev-linha" style={{ borderLeftColor: t.cor }}>
      <span className="ev-ico" style={{ background: t.bg }}>{t.ico}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ev-titulo">{e.titulo}</div>
        {e.detalhe && <div className="ev-detalhe">{e.detalhe}</div>}
        <div className="ev-meta">
          {t.rotulo}{e.extra ? ' · ' + e.extra : ''}{e.empresa ? ' · ' + e.empresa : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
        {e.badge && <span className="pill pill-gray">{e.badge}</span>}
        {mostrarData && (
          <span className={'ev-prazo' + (urgente ? ' urg' : '')}>
            {dd === 0 ? 'hoje' : dd === 1 ? 'amanhã' : `em ${dd}d`}
          </span>
        )}
        <Link href={t.href} className="iBtn">abrir</Link>
      </div>
    </div>
  )
}
