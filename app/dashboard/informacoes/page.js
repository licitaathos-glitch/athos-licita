'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'

export default function InformacoesPage() {
  const { usuario } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfil === 'empresa'

  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null) // null = fechado; {} = novo; objeto = editar

  function carregar() {
    fetch('/api/informacoes').then(r => r.json())
      .then(r => { r.sucesso ? setItens(r.itens) : setErro(r.erro || 'Erro ao carregar.') })
      .catch(() => setErro('Erro de conexão.'))
  }
  useEffect(() => { carregar() }, [])

  if (erro) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>{erro}</div>
  if (!itens) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Carregando...</div>

  const q = busca.toLowerCase()
  const filtrados = itens.filter(i => !q || [i.titulo, i.categoria, i.descricao].join(' ').toLowerCase().includes(q))
  const categorias = [...new Set(filtrados.map(i => i.categoria))]

  async function excluir(id) {
    if (!confirm('Remover este link?')) return
    const r = await fetch('/api/informacoes', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    }).then(x => x.json())
    if (r.sucesso) carregar(); else alert(r.erro || 'Erro.')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="sec-title">Informações Importantes</h2>
          <p className="sec-sub">Links para emissão e consulta de certidões, cadastros e portais de licitação</p>
        </div>
        {!somenteConsulta && (
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => setEditando({})}>+ Novo link</button>
        )}
      </div>

      <input className="busca-input" style={{ width: '100%', marginBottom: 16 }}
        placeholder="Buscar por título, categoria ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} />

      {categorias.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Nenhum link encontrado.</div>}

      {categorias.map(cat => (
        <div key={cat} className="cat-bloco" style={{ marginBottom: 16 }}>
          <div className="cat-hdr">{cat}</div>
          {filtrados.filter(i => i.categoria === cat).map(i => (
            <div className="doc-row" key={i.id}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, color: '#1B2E4B', fontSize: 13.5 }}>{i.titulo}</div>
                {i.descricao && <div className="doc-obs">{i.descricao}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {i.link
                  ? <a href={i.link} target="_blank" rel="noreferrer" className="iBtn iBtn-up">🔗 Abrir site</a>
                  : <span className="pill pill-gray">sem link direto</span>}
                {!somenteConsulta && <>
                  <button className="iBtn" onClick={() => setEditando(i)}>✏️</button>
                  <button className="iBtn iBtn-del" onClick={() => excluir(i.id)}>🗑</button>
                </>}
              </div>
            </div>
          ))}
        </div>
      ))}

      {editando && (
        <ModalLink item={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar() }} />
      )}
    </div>
  )
}

function ModalLink({ item, onFechar, onSalvo }) {
  const ed = !!item.id
  const [categoria, setCategoria] = useState(item.categoria || '')
  const [titulo, setTitulo] = useState(item.titulo || '')
  const [link, setLink] = useState(item.link || '')
  const [descricao, setDescricao] = useState(item.descricao || '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!categoria.trim() || !titulo.trim()) { setErro('Categoria e título são obrigatórios.'); return }
    setErro(''); setSalvando(true)
    try {
      const r = await fetch('/api/informacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id || null, categoria, titulo, link, descricao }),
      }).then(x => x.json())
      if (r.sucesso) onSalvo(); else setErro(r.erro || 'Erro ao salvar.')
    } catch { setErro('Erro de conexão.') }
    setSalvando(false)
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal">
        <div className="modal-hdr">
          <div><div className="modal-hdr-sub">INFORMAÇÃO IMPORTANTE</div><div className="modal-hdr-title">{ed ? 'Editar link' : 'Novo link'}</div></div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-sub"><label>CATEGORIA</label>
            <input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Regularidade Fiscal e Trabalhista" /></div>
          <div className="form-sub"><label>TÍTULO</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: FGTS — Certificado de Regularidade" /></div>
          <div className="form-sub"><label>LINK</label>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." /></div>
          <div className="form-sub"><label>DESCRIÇÃO / PASSO A PASSO (opcional)</label>
            <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Como emitir, prazo de validade, observações..." /></div>
          {erro && <div className="l-err">{erro}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
