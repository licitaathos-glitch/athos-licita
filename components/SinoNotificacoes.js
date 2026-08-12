'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { montarNotificacoes } from '@/lib/notificacoes'

const CHAVE_LIDAS = 'athos:notifLidas'

// As "lidas" ficam no navegador: são avisos de tela, não dado de negócio, e
// gravar isso na planilha a cada clique só geraria escrita à toa.
function lerLidas() {
  try { return new Set(JSON.parse(localStorage.getItem(CHAVE_LIDAS) || '[]')) } catch { return new Set() }
}
function gravarLidas(set) {
  // Guarda no máximo as 300 mais recentes para o armazenamento não crescer sem fim
  try { localStorage.setItem(CHAVE_LIDAS, JSON.stringify([...set].slice(-300))) } catch {}
}

export default function SinoNotificacoes() {
  const router = useRouter()
  const [fontes, setFontes] = useState(null)
  const [lista, setLista] = useState([])
  const [lidas, setLidas] = useState(() => new Set())
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)

  useEffect(() => { setLidas(lerLidas()) }, [])

  const carregar = useCallback(() => {
    fetch('/api/notificacoes')
      .then(r => r.json())
      .then(r => { if (r.sucesso) setFontes(r) })
      .catch(() => {})
  }, [])

  // Busca as fontes a cada 5 min; recalcula os horários a cada 30 s, que é o
  // que faz o aviso de "30 min" e "10 min" aparecer na hora certa.
  useEffect(() => {
    carregar()
    // 10 min: as fontes mudam devagar e cada busca custa cota do Sheets.
    // Quem dá a sensação de tempo real é o recálculo local, a cada 30 s.
    const t = setInterval(carregar, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [carregar])

  useEffect(() => {
    if (!fontes) return
    const recalcular = () => setLista(montarNotificacoes(fontes, new Date()))
    recalcular()
    const t = setInterval(recalcular, 30 * 1000)
    return () => clearInterval(t)
  }, [fontes])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const fora = e => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const naoLidas = lista.filter(n => !lidas.has(n.id))
  const urgentes = naoLidas.filter(n => n.urgencia === 'alta').length

  function marcarLida(id) {
    setLidas(atual => { const novo = new Set(atual); novo.add(id); gravarLidas(novo); return novo })
  }
  function marcarTodas() {
    setLidas(atual => { const novo = new Set(atual); lista.forEach(n => novo.add(n.id)); gravarLidas(novo); return novo })
  }
  function abrir(n) {
    marcarLida(n.id)
    setAberto(false)
    if (n.href) router.push(n.href)
  }

  return (
    <div style={{ position: 'relative' }} ref={caixa}>
      <button onClick={() => setAberto(a => !a)} title="Notificações"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, position: 'relative', padding: '2px 6px', lineHeight: 1 }}>
        🔔
        {naoLidas.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, padding: '0 4px',
            borderRadius: 9, background: urgentes ? '#DC2626' : '#B9A06B', color: '#fff',
            fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{naoLidas.length > 99 ? '99+' : naoLidas.length}</span>
        )}
      </button>

      {aberto && (
        <div style={{
          position: 'absolute', right: 0, top: 32, width: 340, maxHeight: 420, overflowY: 'auto',
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, zIndex: 90,
          boxShadow: '0 10px 30px rgba(0,0,0,.14)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
            <strong style={{ fontSize: 12.5, color: '#145653' }}>Notificações</strong>
            {naoLidas.length > 0 && (
              <button className="iBtn" onClick={marcarTodas}>marcar todas como lidas</button>
            )}
          </div>

          {lista.length === 0 && (
            <p style={{ padding: 16, fontSize: 12.5, color: '#94A3B8', margin: 0, textAlign: 'center' }}>
              Nada por agora. Sessões, retornos, cotações respondidas e tarefas aparecem aqui.
            </p>
          )}

          {lista.map(n => {
            const lida = lidas.has(n.id)
            return (
              <div key={n.id} onClick={() => abrir(n)}
                style={{
                  display: 'flex', gap: 8, padding: '10px 12px', cursor: 'pointer',
                  borderBottom: '1px solid #F8FAFC', background: lida ? '#fff' : '#F8FAFC',
                  borderLeft: '3px solid ' + (lida ? 'transparent' : n.urgencia === 'alta' ? '#DC2626' : '#B9A06B'),
                }}>
                <span style={{ fontSize: 15 }}>{n.icone}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: lida ? 500 : 700, color: '#2E2D2F' }}>{n.titulo}</div>
                  {n.detalhe && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{n.detalhe}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
