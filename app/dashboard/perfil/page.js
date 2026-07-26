'use client'
import { useState } from 'react'
import { useApp } from '@/lib/AppContext'

const ROTULO = { adm: 'Administrador', analista: 'Analista', empresa: 'Empresa' }

export default function PerfilPage() {
  const { usuario } = useApp()
  const [pinAtual, setPinAtual] = useState('')
  const [novoPin, setNovoPin] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function alterar() {
    setMsg(''); setErro('')
    if (!/^\d{6}$/.test(pinAtual)) { setErro('Informe o PIN atual (6 dígitos).'); return }
    if (!/^\d{6}$/.test(novoPin)) { setErro('O novo PIN deve ter 6 dígitos.'); return }
    if (novoPin !== confirmar) { setErro('A confirmação não confere com o novo PIN.'); return }

    setSalvando(true)
    try {
      const r = await fetch('/api/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinAtual, novoPin }),
      }).then(x => x.json())
      if (r.sucesso) {
        setMsg('PIN alterado com sucesso. Use o novo PIN no próximo acesso.')
        setPinAtual(''); setNovoPin(''); setConfirmar('')
      } else setErro(r.erro || 'Não foi possível alterar o PIN.')
    } catch {
      setErro('Erro de conexão.')
    }
    setSalvando(false)
  }

  return (
    <div>
      <h2 className="sec-title">Meu perfil</h2>
      <p className="sec-sub">Seus dados e PIN de acesso</p>

      <div style={{ maxWidth: 460 }}>
        <div className="form-card">
          <div className="form-card-title">👤 Dados cadastrais</div>
          <div className="form-sub"><label>NOME</label><input value={usuario?.nome || ''} readOnly /></div>
          <div className="form-sub"><label>E-MAIL</label><input value={usuario?.email || ''} readOnly /></div>
          <div className="form-sub">
            <label>PERFIL</label>
            <input value={ROTULO[String(usuario?.perfil || '').toLowerCase()] || usuario?.perfil || ''} readOnly />
          </div>
          <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 10 }}>
            Para alterar nome ou perfil, fale com o administrador.
          </p>
        </div>

        <div className="form-card" style={{ marginTop: 16 }}>
          <div className="form-card-title">🔒 Alterar meu PIN</div>
          <div className="form-sub">
            <label>PIN ATUAL</label>
            <input type="password" inputMode="numeric" maxLength={6} value={pinAtual}
              onChange={e => setPinAtual(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
          </div>
          <div className="form-sub">
            <label>NOVO PIN (6 DÍGITOS)</label>
            <input type="password" inputMode="numeric" maxLength={6} value={novoPin}
              onChange={e => setNovoPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
          </div>
          <div className="form-sub">
            <label>CONFIRMAR NOVO PIN</label>
            <input type="password" inputMode="numeric" maxLength={6} value={confirmar}
              onChange={e => setConfirmar(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
          </div>
          {msg && <div className="l-ok" style={{ marginTop: 10 }}>{msg}</div>}
          {erro && <div className="l-err" style={{ marginTop: 10 }}>{erro}</div>}
          <button className="btn-primary" onClick={alterar} disabled={salvando}>
            {salvando ? 'Alterando...' : 'Alterar PIN'}
          </button>
        </div>
      </div>
    </div>
  )
}
