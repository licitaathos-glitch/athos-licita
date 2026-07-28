'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [tela, setTela] = useState('login') // login | esqueci | redefinir
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [token, setToken] = useState('')
  const [novoPin, setNovoPin] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [carregando, setCarregando] = useState(false)
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]

  function limparMsgs() { setErro(''); setOk('') }

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
    limparMsgs(); setCarregando(true)
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

  async function solicitarCodigo() {
    if (!email) { setErro('Informe o e-mail cadastrado.'); return }
    limparMsgs(); setCarregando(true)
    try {
      const r = await fetch('/api/esqueci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(x => x.json())
      if (r.sucesso) { setOk(r.mensagem || 'Código enviado! Verifique seu e-mail.'); setTela('redefinir') }
      else setErro(r.erro || 'Não foi possível enviar o código.')
    } catch {
      setErro('Erro de conexão.')
    }
    setCarregando(false)
  }

  async function redefinir() {
    if (!token || !novoPin) { setErro('Preencha o código e o novo PIN.'); return }
    limparMsgs(); setCarregando(true)
    try {
      const r = await fetch('/api/redefinir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, novoPin }),
      }).then(x => x.json())
      if (r.sucesso) {
        setTela('login'); setPin(['', '', '', '', '', ''])
        setOk('PIN alterado com sucesso! Entre com o novo PIN.')
        setToken(''); setNovoPin('')
      } else setErro(r.erro || 'Não foi possível redefinir.')
    } catch {
      setErro('Erro de conexão.')
    }
    setCarregando(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <img src="/brand/athos-mark.png" alt="Athos Licita" className="ico brand-mark" />
          <h1>Athos Licita</h1>
          <p>Plataforma integrada de gestão de licitações</p>
        </div>
        <div className="login-card">

          {tela === 'login' && (<>
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
            {ok && <div className="l-ok">{ok}</div>}
            {erro && <div className="l-err">{erro}</div>}
            <button className="btn-login" onClick={entrar} disabled={carregando}>
              {carregando ? 'Verificando...' : 'Entrar'}
            </button>
            <button className="l-link" onClick={() => { setTela('esqueci'); limparMsgs() }}>
              Esqueci meu PIN
            </button>
          </>)}

          {tela === 'esqueci' && (<>
            <h2>Recuperar acesso</h2>
            <p className="sub">Enviaremos um código de 6 dígitos para o seu e-mail</p>
            <div className="lf">
              <label>E-MAIL CADASTRADO</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" autoComplete="email" />
            </div>
            {erro && <div className="l-err">{erro}</div>}
            <button className="btn-login" onClick={solicitarCodigo} disabled={carregando}>
              {carregando ? 'Enviando...' : 'Enviar código'}
            </button>
            <button className="l-link" onClick={() => { setTela('login'); limparMsgs() }}>
              ← Voltar ao login
            </button>
          </>)}

          {tela === 'redefinir' && (<>
            <h2>Redefinir PIN</h2>
            <p className="sub">Digite o código recebido por e-mail e o novo PIN</p>
            {ok && <div className="l-ok">{ok}</div>}
            <div className="lf">
              <label>CÓDIGO RECEBIDO (6 DÍGITOS)</label>
              <input type="tel" inputMode="numeric" maxLength={6} value={token}
                onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" />
            </div>
            <div className="lf">
              <label>NOVO PIN (6 DÍGITOS)</label>
              <input type="tel" inputMode="numeric" maxLength={6} value={novoPin}
                onChange={e => setNovoPin(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" />
            </div>
            {erro && <div className="l-err">{erro}</div>}
            <button className="btn-login" onClick={redefinir} disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar novo PIN'}
            </button>
            <button className="l-link" onClick={() => { setTela('esqueci'); limparMsgs() }}>
              Não recebi o código
            </button>
          </>)}

        </div>
      </div>
    </div>
  )
}
