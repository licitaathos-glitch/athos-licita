'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { AppProvider, useApp } from '@/lib/AppContext'
import Sidebar from '@/components/Sidebar'
import SinoNotificacoes from '@/components/SinoNotificacoes'
import { menuDaRota } from '@/lib/menus'

function Shell({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { usuario, erro, carregando, menusAtuais } = useApp()

  // Bloqueia o acesso por URL direta a um módulo que o usuário não tem
  const chave = menuDaRota(pathname)
  const permitidos = Array.isArray(menusAtuais) ? menusAtuais : []
  const semAcesso = !carregando && usuario && chave && !permitidos.includes(chave)

  async function sair() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-content">
        <div className="topbar">
          <div className="brand"><img src="/brand/athos-mark.png" alt="" className="ico brand-mark" /> Athos Licita</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {usuario && <SinoNotificacoes />}
            {usuario && <span style={{ fontSize: 13, opacity: .8 }}>{usuario.nome?.split(' ')[0]}</span>}
            <button onClick={sair}>Sair</button>
          </div>
        </div>
        <div className="main">
          {erro ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
          ) : carregando ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>
          ) : semAcesso ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
              <div style={{ fontWeight: 700, color: '#145653', marginBottom: 6 }}>Sem acesso a este módulo</div>
              <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>
                Fale com o administrador se você precisa deste acesso.
              </p>
              <Link href="/dashboard" className="btn-ghost">Voltar ao Dashboard</Link>
            </div>
          ) : children}
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  )
}
