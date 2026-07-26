'use client'
import { useRouter } from 'next/navigation'
import { AppProvider, useApp } from '@/lib/AppContext'
import Sidebar from '@/components/Sidebar'

function Shell({ children }) {
  const router = useRouter()
  const { usuario, erro, carregando } = useApp()

  async function sair() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-content">
        <div className="topbar">
          <div className="brand"><span className="ico">⚡</span> Athos Licita</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {usuario && <span style={{ fontSize: 13, opacity: .8 }}>{usuario.nome?.split(' ')[0]}</span>}
            <button onClick={sair}>Sair</button>
          </div>
        </div>
        <div className="main">
          {erro ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
          ) : carregando ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>
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
