'use client'
import { useApp } from '@/lib/AppContext'

export default function ModuloStub({ titulo, descricao }) {
  const { usuario, empresas, empresaAtual } = useApp()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  const somenteConsulta = perfil === 'empresa'
  const empresaNome = empresaAtual === 'todas'
    ? 'Todas as empresas'
    : (empresas.find(e => String(e.id) === String(empresaAtual))?.nome || '')

  return (
    <div>
      <h2 className="sec-title">{titulo}</h2>
      <p className="sec-sub">
        {empresaNome}
        {somenteConsulta ? ' · modo consulta' : ''}
      </p>
      <div className="stub-card">
        <div className="stub-card-ico">🚧</div>
        <p>{descricao}</p>
      </div>
    </div>
  )
}
