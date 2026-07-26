'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]

  function onDigit(i, v) {
    const d = v.replace(/\D/g, '').slice(-1)
    const novo = [...pin]
    novo[i] = d
    setPin(novo)
    if (d && i < 5) refs[i + 1].current?.focus()
  }

  function onKey(i, e) {
    if (e.key === 'Backspace' && !pin[i] && i > 0) refs[i - 1].current?.focus()
    if (e.key === 'Enter') entrar()
  }

  function onPaste(e) {
    e.preventDefault()
    const txt = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    const novo = ['', '', '', '', '', '']
    txt.split('').forEach((c, j) => { novo[j] = c })
    setPin(novo)
    refs[Math.min(txt.length, 5)].current?.focus()
  }

  async function entrar() {
    const pinStr = pin.join('')
    if (!email || pinStr.length < 6) { setErro('Preencha e-mail e os 6 dígitos do PIN.'); return }
    setErro(''); setCarregando(true)
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin: pinStr }),
      }).then(x => x.json())
      if (r.sucesso) router.push('/dashboard')
      else { setErro(r.erro || 'PIN incorreto.'); setPin(['', '', '', '', '', '']) }
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    }
    setCarregando(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <div className="ico">⚡</div>
          <h1>Athos Licita</h1>
          <p>Plataforma integrada de gestão de licitações</p>
        </div>
        <div className="login-card">
          <h2>Entrar na plataforma</h2>
          <p className="sub">E-mail + PIN de 6 dígitos</p>
          <div className="lf">
            <label>E-MAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email" />
          </div>
          <div className="lf">
            <label>PIN DE ACESSO</label>
            <div className="pin-wrap" onPaste={onPaste}>
              {pin.map((d, i) => (
                <input key={i} ref={refs[i]} className="pin-digit" type="tel" inputMode="numeric"
                  maxLength={1} value={d}
                  onChange={e => onDigit(i, e.target.value)}
                  onKeyDown={e => onKey(i, e)} />
              ))}
            </div>
          </div>
          {erro && <div className="l-err">{erro}</div>}
          <button className="btn-login" onClick={entrar} disabled={carregando}>
            {carregando ? 'Verificando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
