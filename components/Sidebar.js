'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/lib/AppContext'

const ITENS_BASE = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { key: 'oportunidades', label: 'Oportunidades', href: '/dashboard/oportunidades', icon: '🔎' },
  { key: 'licitacoes', label: 'Licitações', href: '/dashboard/licitacoes', icon: '📄' },
  { key: 'certidoes', label: 'Certidões', href: '/dashboard/certidoes', icon: '📜' },
  { key: 'atas', label: 'Gestão de Atas', href: '/dashboard/atas', icon: '🗂️' },
  { key: 'calendario', label: 'Calendário e Alertas', href: '/dashboard/calendario', icon: '📅' },
  { key: 'financeiro', label: 'Financeiro', href: '/dashboard/financeiro', icon: '💰' },
]

const ITENS_ADM = [
  { key: 'empresas', label: 'Empresas', href: '/dashboard/empresas', icon: '🏢' },
  { key: 'usuarios', label: 'Usuários', href: '/dashboard/usuarios', icon: '👥' },
]

const ROTULO_PERFIL = { adm: 'Administrador', analista: 'Analista', empresa: 'Empresa' }

export default function Sidebar() {
  const pathname = usePathname()
  const { usuario, empresas, empresaAtual, setEmpresaAtual } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const itens = perfil === 'adm' ? [...ITENS_BASE, ...ITENS_ADM] : ITENS_BASE
  const mostrarSeletor = (perfil === 'adm' || perfil === 'analista') && empresas.length > 0

  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="ico">⚡</span> Athos Licita</div>

      {mostrarSeletor && (
        <div className="sidebar-empresa">
          <label>EMPRESA</label>
          <select value={empresaAtual} onChange={e => setEmpresaAtual(e.target.value)}>
            <option value="todas">Todas as empresas</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      )}

      <nav className="sidebar-nav">
        {itens.map(it => (
          <Link
            key={it.key}
            href={it.href}
            className={'sidebar-link' + (pathname === it.href ? ' active' : '')}
          >
            <span className="sidebar-link-ico">{it.icon}</span> {it.label}
          </Link>
        ))}
      </nav>

      {usuario && (
        <Link href="/dashboard/perfil" className="sidebar-perfil">
          <span>
            {ROTULO_PERFIL[perfil] || perfil}
            <span className="sidebar-perfil-edit">✏️ meu perfil e PIN</span>
          </span>
          {perfil === 'empresa' && <span className="sidebar-perfil-tag">consulta</span>}
        </Link>
      )}
    </aside>
  )
}
