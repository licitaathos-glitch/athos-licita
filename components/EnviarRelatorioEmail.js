'use client'
import { useEffect, useState } from 'react'

const OUTRO = '__outro__'

// Painel "Enviar por e-mail" da tela de relatório mensal. O destinatário vem
// pré-preenchido com o e-mail de contato cadastrado na empresa, mas dá pra
// trocar por um usuário do sistema vinculado a ela ou digitar um e-mail avulso.
export default function EnviarRelatorioEmail({ empresaId, empresa, mes }) {
  const [aberto, setAberto] = useState(false)
  const [opcoes, setOpcoes] = useState([])
  const [destino, setDestino] = useState('')
  const [custom, setCustom] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let cancelado = false
    setMsg(null)
    const lista = []
    if (empresa?.email) lista.push({ valor: empresa.email, rotulo: `Contato da empresa — ${empresa.email}` })

    fetch('/api/usuarios').then(r => r.json()).then(r => {
      if (cancelado) return
      if (r.sucesso) {
        r.usuarios
          .filter(u => u.email && String(u.perfil).toLowerCase() === 'empresa' && (
            String(u.empresa_id) === String(empresaId) ||
            String(u.empresas_permitidas || '').split(',').map(s => s.trim()).includes(String(empresaId))
          ))
          .forEach(u => {
            if (!lista.some(o => o.valor === u.email)) lista.push({ valor: u.email, rotulo: `${u.nome} — ${u.email}` })
          })
      }
      lista.push({ valor: OUTRO, rotulo: 'Digitar outro e-mail...' })
      setOpcoes(lista)
      setDestino(lista[0]?.valor || OUTRO)
    }).catch(() => {
      lista.push({ valor: OUTRO, rotulo: 'Digitar outro e-mail...' })
      if (!cancelado) { setOpcoes(lista); setDestino(lista[0]?.valor || OUTRO) }
    })

    return () => { cancelado = true }
  }, [empresaId, empresa])

  const enviar = () => {
    const destinatarioEmail = destino === OUTRO ? custom.trim() : destino
    if (!destinatarioEmail || !destinatarioEmail.includes('@')) {
      setMsg({ tipo: 'erro', texto: 'Informe um e-mail válido.' })
      return
    }
    setEnviando(true)
    setMsg(null)
    fetch('/api/licitacoes/relatorio-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId, mes, destinatarioEmail }),
    }).then(r => r.json()).then(r => {
      setEnviando(false)
      if (r.sucesso) setMsg({ tipo: 'ok', texto: `Relatório enviado para ${destinatarioEmail}.` })
      else setMsg({ tipo: 'erro', texto: r.erro || 'Não foi possível enviar o e-mail.' })
    }).catch(() => {
      setEnviando(false)
      setMsg({ tipo: 'erro', texto: 'Erro de conexão ao enviar o e-mail.' })
    })
  }

  if (!aberto) {
    return (
      <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setAberto(true)}>
        ✉️ Enviar por e-mail
      </button>
    )
  }

  const campoEstilo = { padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', width: '100%' }

  return (
    <div className="form-card" style={{ marginTop: 12 }}>
      <label className="mini-lbl">ENVIAR RELATÓRIO POR E-MAIL</label>
      <select style={{ ...campoEstilo, marginTop: 6 }} value={destino} onChange={e => { setDestino(e.target.value); setMsg(null) }}>
        {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
      {destino === OUTRO && (
        <input
          type="email" placeholder="email@exemplo.com" value={custom}
          style={{ ...campoEstilo, marginTop: 8 }}
          onChange={e => { setCustom(e.target.value); setMsg(null) }}
        />
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" className="btn-primary" style={{ marginTop: 0 }} onClick={enviar} disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => { setAberto(false); setMsg(null) }} disabled={enviando}>
          Cancelar
        </button>
      </div>
      {msg && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
          {msg.tipo === 'ok' ? '✓ ' : '⚠ '}{msg.texto}
        </p>
      )}
    </div>
  )
}
