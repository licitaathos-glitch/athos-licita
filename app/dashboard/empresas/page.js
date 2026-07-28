'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/lib/AppContext'
import { MODELOS } from '@/lib/comercial'

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
  const [configs, setConfigs] = useState({})

  async function carregar() {
    const [r, c] = await Promise.all([
      fetch('/api/empresas').then(x => x.json()),
      fetch('/api/config-empresa').then(x => x.json()),
    ])
    if (r.sucesso) setLista(r.empresas)
    if (c.sucesso) setConfigs(c.configs)
  }

  async function salvarConfig(empresaId, dados) {
    const r = await fetch('/api/config-empresa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId, ...dados }),
    }).then(x => x.json())
    if (r.sucesso) carregar(); else alert(r.erro || 'Erro ao salvar.')
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

      <div style={{ fontSize: 14, fontWeight: 700, color: '#145653', margin: '20px 0 12px' }}>
        Empresas cadastradas ({lista.length})
      </div>
      {lista.map(e => (
        <CardEmpresa key={e.id} empresa={e} config={configs[String(e.id)]} onSalvar={salvarConfig} />
      ))}
    </div>
  )
}


function CardEmpresa({ empresa, config, onSalvar }) {
  const [aberto, setAberto] = useState(false)
  const atual = config || { modelo: 'revenda', percentualComissao: '', observacao: '' }
  const [modelo, setModelo] = useState(atual.modelo)
  const [perc, setPerc] = useState(atual.percentualComissao)
  const [obs, setObs] = useState(atual.observacao)
  const [salvando, setSalvando] = useState(false)

  const rotulo = MODELOS.find(m => m.id === atual.modelo)?.nome || 'Revenda'

  async function salvar() {
    setSalvando(true)
    await onSalvar(empresa.id, { modelo, percentualComissao: perc, observacao: obs })
    setSalvando(false); setAberto(false)
  }

  return (
    <div>
      <div className="emp-card" style={{ cursor: 'pointer' }} onClick={() => setAberto(a => !a)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#145653' }}>{empresa.nome}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {empresa.cnpj}{empresa.responsavel ? ' · ' + empresa.responsavel : ''}
          </div>
        </div>
        <span className="pill pill-gray">
          {rotulo}{atual.modelo === 'comissao' && atual.percentualComissao ? ' ' + atual.percentualComissao + '%' : ''}
        </span>
      </div>

      {aberto && (
        <div className="detalhe-card">
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#145653', marginBottom: 10 }}>
            💼 Modelo comercial — define como a receita é calculada no Financeiro
          </div>
          {MODELOS.map(m => (
            <label key={m.id} className={'modelo-opt' + (modelo === m.id ? ' on' : '')}>
              <input type="radio" name={'modelo-' + empresa.id} checked={modelo === m.id} onChange={() => setModelo(m.id)} />
              <span>
                <strong>{m.nome}</strong>
                <span style={{ display: 'block', fontSize: 11.5, color: '#64748B' }}>{m.desc}</span>
              </span>
            </label>
          ))}

          {modelo === 'comissao' && (
            <div className="form-sub" style={{ maxWidth: 200 }}>
              <label>PERCENTUAL DE COMISSÃO (%)</label>
              <input type="number" step="0.01" value={perc} onChange={ev => setPerc(ev.target.value)} placeholder="2" />
            </div>
          )}

          <div className="form-sub">
            <label>OBSERVAÇÃO</label>
            <input value={obs} onChange={ev => setObs(ev.target.value)} placeholder="Ex: comissão paga 30 dias após o pagamento do órgão" />
          </div>

          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar modelo comercial'}
          </button>
        </div>
      )}
    </div>
  )
}
