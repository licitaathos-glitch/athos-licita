// Catálogo único dos menus do sistema — usado pela sidebar, pelo cadastro de
// usuários e pela checagem de permissão no servidor.
export const MENUS = [
  { key: 'dashboard',     label: 'Dashboard',            href: '/dashboard',                    icon: '📊', fixo: true },
  { key: 'oportunidades', label: 'Oportunidades',        href: '/dashboard/oportunidades',      icon: '🔎' },
  { key: 'licitacoes',    label: 'Licitações',           href: '/dashboard/licitacoes',         icon: '📄' },
  { key: 'certidoes',     label: 'Certidões',            href: '/dashboard/certidoes',          icon: '📜' },
  { key: 'atas',          label: 'Gestão de Atas',       href: '/dashboard/atas',               icon: '🗂️' },
  { key: 'calendario',    label: 'Calendário e Alertas', href: '/dashboard/calendario',         icon: '📅' },
  { key: 'financeiro',    label: 'Financeiro',           href: '/dashboard/financeiro',         icon: '💰' },
  { key: 'relatorio',     label: 'Relatório mensal',     href: '/dashboard/relatorio',          icon: '📈' },
  { key: 'empresas',      label: 'Empresas',             href: '/dashboard/empresas',           icon: '🏢', somenteAdm: true },
  { key: 'usuarios',      label: 'Usuários',             href: '/dashboard/usuarios',           icon: '👥', somenteAdm: true },
]

// Menus que o administrador pode conceder a um usuário (Dashboard é sempre concedido)
export const MENUS_CONCEDIVEIS = MENUS.filter(m => !m.fixo && !m.somenteAdm)

// Padrão quando o usuário não tem nada marcado — mantém o comportamento anterior
export const PADRAO_POR_PERFIL = {
  adm: MENUS.map(m => m.key),
  analista: MENUS.filter(m => !m.somenteAdm).map(m => m.key),
  empresa: MENUS.filter(m => !m.somenteAdm).map(m => m.key),
}

// Descobre a qual menu uma rota pertence (a mais específica vence)
export function menuDaRota(pathname) {
  const encontrado = MENUS
    .filter(m => pathname === m.href || pathname.startsWith(m.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return encontrado?.key || null
}
