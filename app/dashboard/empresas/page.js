'use client'
import ModalNovoRegistro from '@/components/ModalNovoRegistro'
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

  async function salvarDados(empresaId, dados) {
    const r = await fetch('/api/empresas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: empresaId, ...dados }),
    }).then(x => x.json())
    if (r.sucesso) { carregar(); recarregarEmpresas() }
    return r
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
        <CardEmpresa key={e.id} empresa={e} config={configs[String(e.id)]} onSalvar={salvarConfig} onSalvarDados={salvarDados} />
      ))}
    </div>
  )
}


function CardEmpresa({ empresa, config, onSalvar, onSalvarDados }) {
  const [aberto, setAberto] = useState(false)
  const [novaTarefa, setNovaTarefa] = useState(false)
  const atual = config || { modelo: 'revenda', percentualComissao: '', observacao: '' }
  const [modelo, setModelo] = useState(atual.modelo)
  const [perc, setPerc] = useState(atual.percentualComissao)
  const [obs, setObs] = useState(atual.observacao)
  const [salvando, setSalvando] = useState(false)

  const [dNome, setDNome] = useState(empresa.nome || '')
  const [dCnpj, setDCnpj] = useState(empresa.cnpj || '')
  const [dResponsavel, setDResponsavel] = useState(empresa.responsavel || '')
  const [dEmail, setDEmail] = useState(empresa.email || '')
  const [dTelefone, setDTelefone] = useState(empresa.telefone || '')
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [msgDados, setMsgDados] = useState('')

  const rotulo = MODELOS.find(m => m.id === atual.modelo)?.nome || 'Revenda'

  async function salvar() {
    setSalvando(true)
    await onSalvar(empresa.id, { modelo, percentualComissao: perc, observacao: obs })
    setSalvando(false); setAberto(false)
  }

  async function salvarDados() {
    if (!dNome.trim()) { setMsgDados('Informe o nome da empresa.'); return }
    setSalvandoDados(true); setMsgDados('')
    const r = await onSalvarDados(empresa.id, {
      nome: dNome, cnpj: dCnpj, responsavel: dResponsavel, email: dEmail, telefone: dTelefone,
    })
    setMsgDados(r.sucesso ? '✅ Dados atualizados.' : '❌ ' + (r.erro || 'Erro ao salvar.'))
    setSalvandoDados(false)
  }

  return (
    <div>
      <div className="emp-card" style={{ cursor: 'pointer' }} onClick={() => setAberto(a => !a)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#145653' }}>{empresa.nome}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {empresa.cnpj}{empresa.responsavel ? ' · ' + empresa.responsavel : ''}{empresa.email ? ' · ' + empresa.email : ''}
          </div>
        </div>
        <button className="iBtn" title="Criar uma tarefa ou evento para esta empresa"
          onClick={e => { e.stopPropagation(); setNovaTarefa(true) }}>➕ Tarefa/evento</button>
        <span className="pill pill-gray">
          {rotulo}{atual.modelo === 'comissao' && atual.percentualComissao ? ' ' + atual.percentualComissao + '%' : ''}
        </span>
      </div>

      {novaTarefa && (
        <ModalNovoRegistro empresaId={empresa.id} empresaNome={empresa.nome}
          onFechar={() => setNovaTarefa(false)} />
      )}

      {aberto && (
        <div className="detalhe-card">
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#145653', marginBottom: 10 }}>
            ✏️ Dados cadastrais
          </div>
          <div className="form-grid">
            <input placeholder="Nome da empresa" value={dNome} onChange={e => setDNome(e.target.value)} />
            <input placeholder="CNPJ" value={dCnpj} onChange={e => setDCnpj(e.target.value)} />
            <input placeholder="Responsável" value={dResponsavel} onChange={e => setDResponsavel(e.target.value)} />
            <input placeholder="E-mail (separe por vírgula se houver mais de um)" value={dEmail} onChange={e => setDEmail(e.target.value)} />
            <input placeholder="Telefone" value={dTelefone} onChange={e => setDTelefone(e.target.value)} />
          </div>
          {msgDados && <p style={{ fontSize: 12, margin: '8px 0 0' }}>{msgDados}</p>}
          <button className="btn-primary" onClick={salvarDados} disabled={salvandoDados}>
            {salvandoDados ? 'Salvando...' : 'Salvar dados cadastrais'}
          </button>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#145653', margin: '18px 0 10px' }}>
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
