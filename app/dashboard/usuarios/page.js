'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'

const ROTULOS = { adm: 'Administrador', analista: 'Analista', empresa: 'Empresa' }

export default function UsuariosPage() {
  const { usuario, empresas } = useApp()
  const meuPerfil = String(usuario?.perfil || '').toLowerCase()

  const [lista, setLista] = useState([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [perfil, setPerfil] = useState('empresa')
  const [empresaId, setEmpresaId] = useState('')
  const [permitidas, setPermitidas] = useState([])
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const r = await fetch('/api/usuarios').then(x => x.json())
    if (r.sucesso) setLista(r.usuarios)
  }

  useEffect(() => { if (meuPerfil === 'adm') carregar() }, [meuPerfil])

  function alternarEmpresa(id) {
    setPermitidas(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  async function salvar() {
    if (!nome.trim() || !email.trim()) { setErro('Informe nome e e-mail.'); return }
    if (perfil === 'empresa' && !empresaId) { setErro('Selecione a empresa vinculada.'); return }
    setErro(''); setMsg(''); setSalvando(true)
    try {
      const r = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, email, perfil,
          empresa_id: perfil === 'empresa' ? empresaId : '',
          empresas_permitidas: perfil === 'analista' ? permitidas.join(',') : '',
        }),
      }).then(x => x.json())
      if (r.sucesso) {
        setMsg('Usuário criado com sucesso. PIN de acesso: ' + r.pin + ' (compartilhe com segurança)')
        setNome(''); setEmail(''); setPerfil('empresa'); setEmpresaId(''); setPermitidas([])
        carregar()
      } else setErro(r.erro || 'Erro ao criar usuário.')
    } catch {
      setErro('Erro de conexão.')
    }
    setSalvando(false)
  }

  if (meuPerfil !== 'adm') {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Você não tem permissão para acessar esta página.</div>
  }

  return (
    <div>
      <h2 className="sec-title">Usuários</h2>
      <p className="sec-sub">Gerenciamento de perfis de acesso</p>

      <div className="form-card">
        <div className="form-card-title">+ Novo usuário</div>
        <div className="form-grid">
          <input placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} />
          <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <select value={perfil} onChange={e => setPerfil(e.target.value)}>
            <option value="adm">Administrador</option>
            <option value="analista">Analista</option>
            <option value="empresa">Empresa</option>
          </select>
        </div>

        {perfil === 'empresa' && (
          <div className="form-sub">
            <label>EMPRESA VINCULADA</label>
            <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}>
              <option value="">Selecione...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        )}

        {perfil === 'analista' && (
          <div className="form-sub">
            <label>EMPRESAS PERMITIDAS (vazio = todas)</label>
            <div className="chip-group">
              {empresas.map(e => (
                <label key={e.id} className="chip">
                  <input
                    type="checkbox"
                    checked={permitidas.includes(String(e.id))}
                    onChange={() => alternarEmpresa(String(e.id))}
                  />
                  {e.nome}
                </label>
              ))}
            </div>
          </div>
        )}

        {msg && <div className="l-ok" style={{ marginTop: 10 }}>{msg}</div>}
        {erro && <div className="l-err" style={{ marginTop: 10 }}>{erro}</div>}
        <button className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Criar usuário'}
        </button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#1B2E4B', margin: '20px 0 12px' }}>
        Usuários cadastrados ({lista.length})
      </div>
      {lista.map(u => (
        <div className="emp-card" key={u.id}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#1B2E4B' }}>{u.nome}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              {u.email} · {ROTULOS[String(u.perfil).toLowerCase()] || u.perfil}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
