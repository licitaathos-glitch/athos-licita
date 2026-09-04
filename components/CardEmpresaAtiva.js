'use client'

const CORES = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', nd: '#94A3B8' }
const ROTULO = { ok: 'Regular', warn: 'Certidão vencendo', bad: 'Certidão vencida', nd: 'Sem certidões cadastradas' }

// Cartão fixo com a identificação da empresa ativa em destaque no topo do
// Dashboard — CNPJ, cidade/UF, representante e o resumo de certidões sempre
// visíveis, sem precisar abrir/expandir nada. Substitui, quando uma única
// empresa está selecionada, a necessidade de clicar na lista de empresas
// para ver esses dados.
export default function CardEmpresaAtiva({ empresa }) {
  if (!empresa) return null
  const cor = CORES[empresa.status] || CORES.nd

  const linhas = [
    empresa.cnpj && { icone: '🧾', texto: empresa.cnpj },
    (empresa.cidade || empresa.uf) && { icone: '📍', texto: [empresa.cidade, empresa.uf].filter(Boolean).join('/') },
    empresa.rep_nome && { icone: '👤', texto: empresa.rep_nome + (empresa.rep_cargo ? ' · ' + empresa.rep_cargo : '') },
    empresa.telefone && { icone: '📞', texto: empresa.telefone },
  ].filter(Boolean)

  return (
    <div style={{
      background: '#fff', border: `2px solid ${cor}55`, borderRadius: 12,
      padding: '16px 18px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 11.5, color: '#94A3B8', margin: '0 0 2px', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Empresa ativa
          </p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#145653', margin: 0, fontFamily: "'Fraunces',serif" }}>
            {empresa.nome}
          </p>
        </div>
        <span className="pill" style={{ background: cor + '22', color: cor, whiteSpace: 'nowrap' }}>
          {ROTULO[empresa.status] || ROTULO.nd}
        </span>
      </div>

      {linhas.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '4px 16px', fontSize: 12.5, color: '#475569', marginBottom: 12,
        }}>
          {linhas.map((l, i) => <span key={i}>{l.icone} {l.texto}</span>)}
        </div>
      )}

      <div style={{
        display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 10, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 80px', textAlign: 'center', background: '#F8FAFC', borderRadius: 8, padding: '6px 4px' }}>
          <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#16A34A' }}>{empresa.regulares}</p>
          <p style={{ fontSize: 10.5, color: '#94A3B8', margin: 0 }}>Regulares</p>
        </div>
        <div style={{ flex: '1 1 80px', textAlign: 'center', background: empresa.alerta ? '#FEF3C7' : '#F8FAFC', borderRadius: 8, padding: '6px 4px' }}>
          <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#D97706' }}>{empresa.alerta}</p>
          <p style={{ fontSize: 10.5, color: empresa.alerta ? '#92400E' : '#94A3B8', margin: 0 }}>Vencendo</p>
        </div>
        <div style={{ flex: '1 1 80px', textAlign: 'center', background: empresa.vencidas ? '#FEE2E2' : '#F8FAFC', borderRadius: 8, padding: '6px 4px' }}>
          <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#DC2626' }}>{empresa.vencidas}</p>
          <p style={{ fontSize: 10.5, color: empresa.vencidas ? '#991B1B' : '#94A3B8', margin: 0 }}>Vencidas</p>
        </div>
        <div style={{ flex: '1 1 80px', textAlign: 'center', background: '#F8FAFC', borderRadius: 8, padding: '6px 4px' }}>
          <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#145653' }}>{empresa.pendencias.length}</p>
          <p style={{ fontSize: 10.5, color: '#94A3B8', margin: 0 }}>Pendências</p>
        </div>
      </div>
    </div>
  )
}
