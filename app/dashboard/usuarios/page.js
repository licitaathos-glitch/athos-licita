'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'

const ROTULOS = { adm: 'Administrador', admin: 'Administrador', analista: 'Analista', empresa: 'Empresa' }

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
        setMsg(r.avisoEmail
          ? 'Usuário criado. ⚠️ O e-mail não foi enviado (' + r.avisoEmail + '). PIN de acesso: ' + r.pin
          : 'Usuário criado! Um e-mail com o PIN de acesso foi enviado para ' + email + '.')
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
            <option value="admin">Administrador</option>
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
        <CardUsuario key={u.id} u={u} empresas={empresas} eu={usuario} onMudou={carregar} />
      ))}
    </div>
  )
}


function CardUsuario({ u, empresas, eu, onMudou }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState(u.nome)
  const [perfil, setPerfil] = useState(String(u.perfil || '').toLowerCase())
  const [empresaId, setEmpresaId] = useState(u.empresa_id || '')
  const [permitidas, setPermitidas] = useState(
    String(u.empresas_permitidas || '').split(',').map(x => x.trim()).filter(Boolean))
  const [ativo, setAtivo] = useState(String(u.ativo).toUpperCase() !== 'FALSE')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const souEu = String(u.email).trim().toLowerCase() === String(eu?.email || '').trim().toLowerCase()
  const inativo = String(u.ativo).toUpperCase() === 'FALSE'

  async function chamar(corpo, metodo = 'PUT') {
    setMsg(''); setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/usuarios', {
        method: metodo, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, ...corpo }),
      }).then(x => x.json())
      if (r.sucesso) {
        if (r.novoPin) {
          setMsg('Novo PIN: ' + r.novoPin + (r.avisoEmail ? ' (e-mail não enviado — repasse manualmente)' : ' — enviado por e-mail'))
        } else { setMsg('Alterações salvas.'); setAberto(false) }
        onMudou()
      } else setErro(r.erro || 'Erro.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  return (
    <div>
      <div className="emp-card" style={{ cursor: 'pointer', opacity: inativo ? .55 : 1 }} onClick={() => setAberto(a => !a)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#1B2E4B' }}>
            {u.nome}
            {souEu && <span style={{ fontSize: 10, color: '#C9A84C', marginLeft: 6 }}>você</span>}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{u.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {inativo && <span className="pill pill-red">desativado</span>}
          <span className="pill pill-gray">{ROTULOS[String(u.perfil).toLowerCase()] || u.perfil}</span>
        </div>
      </div>

      {aberto && (
        <div className="detalhe-card">
          <div className="form-grid">
            <div><label className="mini-lbl">NOME</label>
              <input value={nome} onChange={e => setNome(e.target.value)} /></div>
            <div><label className="mini-lbl">PERFIL</label>
              <select value={perfil} onChange={e => setPerfil(e.target.value)} disabled={souEu}>
                <option value="admin">Administrador</option>
                <option value="analista">Analista</option>
                <option value="empresa">Empresa</option>
              </select></div>
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
                    <input type="checkbox" checked={permitidas.includes(String(e.id))}
                      onChange={() => setPermitidas(p => p.includes(String(e.id))
                        ? p.filter(x => x !== String(e.id)) : [...p, String(e.id)])} />
                    {e.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-sub">
            <label className="chip" style={{ display: 'inline-flex' }}>
              <input type="checkbox" checked={ativo} disabled={souEu}
                onChange={e => setAtivo(e.target.checked)} />
              Conta ativa {souEu && '(não é possível desativar a própria conta)'}
            </label>
          </div>

          {msg && <div className="l-ok" style={{ marginTop: 10 }}>{msg}</div>}
          {erro && <div className="l-err" style={{ marginTop: 10 }}>{erro}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn-primary" style={{ marginTop: 0 }} disabled={salvando}
              onClick={() => chamar({
                nome, perfil, ativo,
                empresa_id: perfil === 'empresa' ? empresaId : '',
                empresas_permitidas: perfil === 'analista' ? permitidas.join(',') : '',
              })}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button className="iBtn" disabled={salvando} onClick={() => {
              if (confirm('Gerar um novo PIN para ' + u.nome + '? O PIN atual deixa de funcionar.')) chamar({ redefinirPin: true })
            }}>🔑 Redefinir PIN</button>
            {!souEu && (
              <button className="iBtn iBtn-del" disabled={salvando} onClick={() => {
                if (confirm('Excluir definitivamente o usuário ' + u.nome + '?')) chamar({}, 'DELETE')
              }}>🗑 Excluir</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
