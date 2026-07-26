'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [empresaAtual, setEmpresaAtual] = useState('todas')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const recarregarEmpresas = useCallback(async () => {
    try {
      const r = await fetch('/api/empresas').then(x => x.json())
      if (r.sucesso) setEmpresas(r.empresas)
    } catch {
      // silencioso — o dashboard/página atual já mostra erro de conexão
    }
  }, [])

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const [rMe, rEmpresas] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/empresas'),
        ])
        if (rMe.status === 401 || rEmpresas.status === 401) { router.push('/login'); return }
        const me = await rMe.json()
        const emp = await rEmpresas.json()
        if (!ativo) return
        if (me.sucesso) setUsuario(me.usuario)
        else setErro(me.erro || 'Erro ao carregar usuário.')
        if (emp.sucesso) {
          setEmpresas(emp.empresas)
          if (String(me.usuario?.perfil).toLowerCase() === 'empresa' && emp.empresas.length === 1) {
            setEmpresaAtual(emp.empresas[0].id)
          }
        }
      } catch {
        if (ativo) setErro('Erro de conexão.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => { ativo = false }
  }, [router])

  return (
    <AppContext.Provider value={{
      usuario, empresas, empresaAtual, setEmpresaAtual,
      carregando, erro, recarregarEmpresas,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp precisa ser usado dentro de <AppProvider>')
  return ctx
}
