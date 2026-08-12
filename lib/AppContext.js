'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [empresaAtual, _setEmpresaAtual] = useState('todas')

  // A empresa escolhida fica guardada no navegador. Sem isso ela voltava para
  // "todas" sempre que o provider era remontado (recarregar a página, um deploy
  // novo entrando no ar, voltar de uma tela fora do dashboard) — o usuário
  // trocava de menu e perdia a empresa em que estava trabalhando.
  const setEmpresaAtual = useCallback(valor => {
    _setEmpresaAtual(valor)
    try { localStorage.setItem('athos:empresaAtual', String(valor)) } catch {}
  }, [])
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
          } else {
            // Restaura a última empresa escolhida, se ela ainda existir e o
            // usuário continuar tendo acesso a ela.
            let salva = ''
            try { salva = localStorage.getItem('athos:empresaAtual') || '' } catch {}
            if (salva && salva !== 'todas' && emp.empresas.some(x => String(x.id) === salva)) {
              _setEmpresaAtual(salva)
            }
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

  // Menus válidos para a empresa selecionada.
  // Com "Todas as empresas", usa a união do que o usuário alcança em alguma delas.
  const menusAtuais = (() => {
    if (!usuario) return []
    const porEmpresa = usuario.menusPorEmpresa || {}
    if (empresaAtual === 'todas') {
      return usuario.menusUnificados || usuario.menus || []
    }
    return porEmpresa[String(empresaAtual)] || usuario.menus || []
  })()

  return (
    <AppContext.Provider value={{
      usuario, empresas, empresaAtual, setEmpresaAtual, menusAtuais,
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
