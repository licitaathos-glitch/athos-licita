'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/AppContext'
import PainelAgenda from '@/components/PainelAgenda'
import PainelPendencias from '@/components/PainelPendencias'
import CardEmpresaAtiva from '@/components/CardEmpresaAtiva'
import ModalDetalheLicitacao from '@/components/ModalDetalheLicitacao'
import { faseDe } from '@/lib/fases'
import { rotuloTipo } from '@/lib/tiposCertidao'

const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#CBD5E1' }

export default function DashboardPage() {
  const router = useRouter()
  const { usuario, empresaAtual, setEmpresaAtual } = useApp()
  const [dados, setDados] = useState(null)
  const [cotacoes, setCotacoes] = useState([])
  const [erro, setErro] = useState('')
  const [empresaAberta, setEmpresaAberta] = useState(null)
  const [licAberta, setLicAberta] = useState(null)
  const [carregandoLic, setCarregandoLic] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json())
      .then(r => (r.sucesso ? setDados(r) : setErro(r.erro || 'Erro ao carregar.')))
      .catch(() => setErro('Erro de conexão.'))
    fetch('/api/agenda').then(r => r.json())
      .then(r => r.sucesso && setCotacoes(r.cotacoes || []))
      .catch(() => {})
  }, [])

  // Abre a licitação sem sair do Dashboard; fechar volta para cá
  async function abrirLicitacao(id) {
    setCarregandoLic(true)
    try {
      const r = await fetch('/api/licitacoes').then(x => x.json())
      const l = r.sucesso ? r.licitacoes.find(x => String(x.id) === String(id)) : null
      if (l) setLicAberta(l); else setErro('Não consegui abrir esta licitação.')
    } catch { setErro('Erro de conexão ao abrir a licitação.') }
    setCarregandoLic(false)
  }

  if (erro && !dados) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!dados) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const perfil = String(usuario?.perfil || '').toLowerCase()
  const empresaSel = empresaAtual !== 'todas' ? String(empresaAtual) : ''
  const empresas = empresaSel ? dados.empresas.filter(e => String(e.id) === empresaSel) : dados.empresas
  const comPendencia = empresas.filter(e => e.vencidas > 0 || e.alerta > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Dashboard</h2>
          <p className="sec-sub">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard/agenda" className="btn-ghost">📅 Calendário</Link>
          {perfil === 'adm' && <Link href="/dashboard/empresas" className="btn-ghost">+ Empresa</Link>}
          {perfil === 'adm' && <Link href="/dashboard/usuarios" className="btn-ghost">+ Usuário</Link>}
        </div>
      </div>

      {empresaSel && empresas[0] && <CardEmpresaAtiva empresa={empresas[0]} />}

      {/* Cada assunto na sua janela, no visual da agenda. Duas colunas no
          desktop, uma no celular — a página quebra em objetos independentes. */}
      <div className="dash-janelas">
        <PainelAgenda apenas="hoje" onAbrirLicitacao={abrirLicitacao} />
        <PainelAgenda apenas="andamento" onAbrirLicitacao={abrirLicitacao} />
        <PainelAgenda apenas="futuras" onAbrirLicitacao={abrirLicitacao} />
        <PainelPendencias onAbrirLicitacao={abrirLicitacao} />

        <div className="janela-dash">
          <div className="janela-dash-hdr">
            <span>⏳ Cotações sem resposta</span>
            <span className="janela-dash-cont">{cotacoes.length}</span>
          </div>
          <div className="janela-dash-corpo">
            {cotacoes.length === 0
              ? <p style={{ fontSize: 12.5, color: '#94A3B8', margin: 0 }}>Nenhum pedido aguardando fornecedor.</p>
              : cotacoes.map(c => (
                <div key={c.id} onClick={() => c.licitacaoId && abrirLicitacao(c.licitacaoId)}
                  style={{
                    display: 'flex', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 6,
                    background: '#F8FAFC', borderLeft: '3px solid #9333EA',
                    cursor: c.licitacaoId ? 'pointer' : 'default',
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2E2D2F' }}>{c.edital}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                      {[c.destinatario, c.empresaNome].filter(Boolean).join(' · ')}
                    </div>
                    {c.objeto && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{c.objeto}</div>}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {!empresaSel && <div className="janela-dash">
          <div className="janela-dash-hdr">
            <span>🏢 Empresas</span>
            <span className="janela-dash-cont">{empresas.length}</span>
            {comPendencia.length > 0 && (
              <span className="pill pill-amber" style={{ marginLeft: 'auto' }}>{comPendencia.length} com pendência</span>
            )}
          </div>
          <div className="janela-dash-corpo">
            {empresas.map(e => (
              <div key={e.id}>
                <div onClick={() => setEmpresaAberta(empresaAberta === e.id ? null : e.id)}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 8,
                    marginBottom: 6, background: '#F8FAFC', borderLeft: `3px solid ${CORES[e.status]}`, cursor: 'pointer',
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2E2D2F' }}>{e.nome}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                      {e.cnpj}{e.responsavel ? ' · ' + e.responsavel : ''}
                    </div>
                  </div>
                  <span className="pill" style={{ background: CORES[e.status] + '22', color: CORES[e.status] }}>
                    {e.vencidas ? `${e.vencidas} vencida(s)` : e.alerta ? `${e.alerta} vencendo` : 'regular'}
                  </span>
                </div>
                {empresaAberta === e.id && (
                  <div style={{ margin: '-2px 0 10px 16px' }}>
                    {(e.pendencias || []).length === 0
                      ? <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 6px' }}>Nenhuma certidão vencida ou vencendo nos próximos 7 dias.</p>
                      : e.pendencias.map((p, i) => (
                        <div key={i} style={{ fontSize: 12, color: p.dias < 0 ? '#B91C1C' : '#B45309', padding: '3px 0' }}>
                          {p.dias < 0 ? '⛔' : '⚠️'} {rotuloTipo(p.tipo)} — {p.validade}
                          {p.dias < 0 ? ` (vencida há ${Math.abs(p.dias)} dia(s))` : ` (vence em ${p.dias} dia(s))`}
                        </div>
                      ))}
                    <Link href="/dashboard/certidoes" className="iBtn" style={{ marginTop: 4, display: 'inline-block' }}>
                      abrir Certidões →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>}
      </div>

      {carregandoLic && (
        <div className="overlay"><div className="modal"><div className="modal-body">Abrindo a licitação...</div></div></div>
      )}

      {licAberta && (
        <ModalDetalheLicitacao
          lic={licAberta} fx={faseDe(licAberta.fase)} somenteConsulta
          onFechar={() => setLicAberta(null)}
          onIrPara={l => {
            if (l.empresa_id) setEmpresaAtual(String(l.empresa_id))
            router.push(`/dashboard/licitacoes?id=${l.id}`)
          }} />
      )}
    </div>
  )
}
