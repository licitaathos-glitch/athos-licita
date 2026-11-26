'use client'
import { useEffect, useState } from 'react'

const RE_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

// Painel "Enviar por e-mail" da tela de relatório. Envia com os mesmos filtros (período e fases) da tela.
// Lista o e-mail de contato da empresa e os usuários vinculados a ela com caixas de marcação: dá pra enviar
// só para quem você marcar (um, vários ou todos) e ainda acrescentar e-mails avulsos digitados.
export default function EnviarRelatorioEmail({ empresaId, empresa, filtros }) {
  const [aberto, setAberto] = useState(false)
  const [opcoes, setOpcoes] = useState([])
  const [marcados, setMarcados] = useState([])
  const [extras, setExtras] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let cancelado = false
    setMsg(null)
    const lista = []
    if (empresa?.email) lista.push({ valor: empresa.email, rotulo: 'Contato da empresa', email: empresa.email })
    const finalizar = () => {
      if (cancelado) return
      setOpcoes(lista)
      setMarcados(lista[0] ? [lista[0].valor] : [])
    }
    fetch('/api/usuarios').then(r => r.json()).then(r => {
      if (r.sucesso) {
        r.usuarios
          .filter(u => u.email && String(u.perfil).toLowerCase() === 'empresa' && (
            String(u.empresa_id) === String(empresaId) ||
            String(u.empresas_permitidas || '').split(',').map(x => x.trim()).includes(String(empresaId))
          ))
          .forEach(u => {
            if (!lista.some(o => o.valor === u.email)) lista.push({ valor: u.email, rotulo: u.nome, email: u.email })
          })
      }
      finalizar()
    }).catch(finalizar)
    return () => { cancelado = true }
  }, [empresaId, empresa])

  const alternar = (v) => { setMarcados(m => m.includes(v) ? m.filter(x => x !== v) : [...m, v]); setMsg(null) }

  const enviar = () => {
    const avulsos = extras.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)
    const destinatarios = [...new Set([...marcados, ...avulsos])]
    if (!destinatarios.length) { setMsg({ tipo: 'erro', texto: 'Marque ao menos um destinatário ou digite um e-mail.' }); return }
    const invalido = destinatarios.find(e => !RE_EMAIL.test(e))
    if (invalido) { setMsg({ tipo: 'erro', texto: `E-mail inválido: ${invalido}` }); return }
    setEnviando(true)
    setMsg(null)
    fetch('/api/licitacoes/relatorio-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresaId, destinatarios,
        de: filtros.de, ate: filtros.ate, fases: filtros.fases,
        incluirAnteriores: filtros.incluirAnteriores, incluirFinanceiro: filtros.mostrarFinanceiro,
      }),
    }).then(r => r.json()).then(r => {
      setEnviando(false)
      if (r.sucesso) setMsg({ tipo: 'ok', texto: `Relatório enviado para ${destinatarios.join(', ')}.` })
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {opcoes.length === 0 && <span style={{ fontSize: 12.5, color: '#94A3B8' }}>Nenhum e-mail cadastrado para esta empresa — digite abaixo.</span>}
        {opcoes.map(o => (
          <label key={o.valor} className="rel-chk">
            <input type="checkbox" checked={marcados.includes(o.valor)} onChange={() => alternar(o.valor)} />
            <span><strong>{o.rotulo}</strong> — {o.email}</span>
          </label>
        ))}
      </div>
      <input
        type="text" placeholder="Outros e-mails (separe por vírgula)" value={extras}
        style={{ ...campoEstilo, marginTop: 10 }}
        onChange={e => { setExtras(e.target.value); setMsg(null) }}
      />
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
