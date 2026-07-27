'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/lib/AppContext'
import { MENUS } from '@/lib/menus'

const ROTULO_PERFIL = { adm: 'Administrador', analista: 'Analista', empresa: 'Empresa' }

export default function Sidebar() {
  const pathname = usePathname()
  const { usuario, empresas, empresaAtual, setEmpresaAtual } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()

  // Só aparecem os menus que o usuário tem permissão de acessar
  const permitidos = Array.isArray(usuario?.menus) ? usuario.menus : []
  const itens = MENUS.filter(m => permitidos.includes(m.key))
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
