'use client'
import { MENUS_CONCEDIVEIS } from '@/lib/menus'

// Seleção de menus com dois níveis:
// - um conjunto padrão, válido para as empresas sem ajuste próprio
// - ajustes por empresa, para quando o analista tem níveis diferentes
export default function MenusPorEmpresa({
  perfil, padrao, setPadrao, porEmpresa, setPorEmpresa, empresasDisponiveis,
}) {
  if (perfil === 'admin') {
    return <p className="dica-menus">Administradores acessam todos os menus em todas as empresas.</p>
  }

  const alternar = (lista, chave) =>
    lista.includes(chave) ? lista.filter(x => x !== chave) : [...lista, chave]

  function ativarAjuste(empresaId) {
    setPorEmpresa({ ...porEmpresa, [empresaId]: [...padrao] })
  }
  function removerAjuste(empresaId) {
    const novo = { ...porEmpresa }
    delete novo[empresaId]
    setPorEmpresa(novo)
  }
  function alternarNaEmpresa(empresaId, chave) {
    setPorEmpresa({ ...porEmpresa, [empresaId]: alternar(porEmpresa[empresaId] || [], chave) })
  }

  return (
    <>
      <div className="form-sub">
        <label>MENUS PADRÃO {perfil === 'analista' ? '(valem para as empresas sem ajuste abaixo)' : ''}</label>
        <div className="chip-group">
          {MENUS_CONCEDIVEIS.map(m => (
            <label key={m.key} className="chip">
              <input type="checkbox" checked={padrao.includes(m.key)}
                onChange={() => setPadrao(alternar(padrao, m.key))} />
              {m.icon} {m.label}
            </label>
          ))}
        </div>
        <p className="dica-menus">O Dashboard e o Meu perfil ficam sempre disponíveis.</p>
      </div>

      {perfil === 'analista' && empresasDisponiveis.length > 0 && (
        <div className="form-sub">
          <label>AJUSTE POR EMPRESA (opcional)</label>
          <p className="dica-menus" style={{ marginTop: 0, marginBottom: 8 }}>
            Use quando o analista precisa de níveis diferentes em cada empresa.
          </p>
          {empresasDisponiveis.map(e => {
            const id = String(e.id)
            const temAjuste = Object.prototype.hasOwnProperty.call(porEmpresa, id)
            return (
              <div className="emp-menus" key={id}>
                <div className="emp-menus-hdr">
                  <strong>{e.nome}</strong>
                  {temAjuste
                    ? <button className="iBtn" onClick={() => removerAjuste(id)}>usar o padrão</button>
                    : <button className="iBtn" onClick={() => ativarAjuste(id)}>ajustar</button>}
                </div>
                {temAjuste ? (
                  <div className="chip-group">
                    {MENUS_CONCEDIVEIS.map(m => (
                      <label key={m.key} className="chip">
                        <input type="checkbox" checked={(porEmpresa[id] || []).includes(m.key)}
                          onChange={() => alternarNaEmpresa(id, m.key)} />
                        {m.icon} {m.label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className="emp-menus-padrao">
                    {padrao.length
                      ? 'Padrão: ' + MENUS_CONCEDIVEIS.filter(m => padrao.includes(m.key)).map(m => m.label).join(', ')
                      : 'Somente Dashboard'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
