'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'

export default function EmpresasPage() {
  const { usuario, recarregarEmpresas } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()

  const [lista, setLista] = useState([])
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [emailEmp, setEmailEmp] = useState('')
  const [telefone, setTelefone] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const r = await fetch('/api/empresas').then(x => x.json())
    if (r.sucesso) setLista(r.empresas)
  }

  useEffect(() => { if (perfil === 'adm') carregar() }, [perfil])

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome da empresa.'); return }
    setErro(''); setMsg(''); setSalvando(true)
    try {
      const r = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cnpj, responsavel, email: emailEmp, telefone }),
      }).then(x => x.json())
      if (r.sucesso) {
        setMsg('Empresa cadastrada com sucesso.')
        setNome(''); setCnpj(''); setResponsavel(''); setEmailEmp(''); setTelefone('')
        carregar(); recarregarEmpresas()
      } else setErro(r.erro || 'Erro ao cadastrar empresa.')
    } catch {
      setErro('Erro de conexão.')
    }
    setSalvando(false)
  }

  if (perfil !== 'adm') {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Você não tem permissão para acessar esta página.</div>
  }

  return (
    <div>
      <h2 className="sec-title">Empresas</h2>
      <p className="sec-sub">Cadastro e gerenciamento das empresas clientes</p>

      <div className="form-card">
        <div className="form-card-title">+ Nova empresa</div>
        <div className="form-grid">
          <input placeholder="Nome da empresa" value={nome} onChange={e => setNome(e.target.value)} />
          <input placeholder="CNPJ" value={cnpj} onChange={e => setCnpj(e.target.value)} />
          <input placeholder="Responsável" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
          <input placeholder="E-mail" value={emailEmp} onChange={e => setEmailEmp(e.target.value)} />
          <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} />
        </div>
        {msg && <div className="l-ok" style={{ marginTop: 10 }}>{msg}</div>}
        {erro && <div className="l-err" style={{ marginTop: 10 }}>{erro}</div>}
        <button className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Cadastrar empresa'}
        </button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#1B2E4B', margin: '20px 0 12px' }}>
        Empresas cadastradas ({lista.length})
      </div>
      {lista.map(e => (
        <div className="emp-card" key={e.id}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#1B2E4B' }}>{e.nome}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>{e.cnpj}{e.responsavel ? ' · ' + e.responsavel : ''}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
