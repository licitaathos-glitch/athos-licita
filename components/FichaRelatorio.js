// Ficha de uma licitação no relatório — o mesmo conteúdo do detalhe da licitação
// (órgão, UASG, modalidade, datas...) seguido da situação, do nosso lance e do
// vencedor. Os dados já vêm prontos de fichaDados (lib/relatorio.js).
import { brl } from '@/lib/relatorio'

const COR_SIT = { ganho: '#16A34A', perdido: '#DC2626', pendente: '#94A3B8' }
const ROTULO_SIT = { ganho: 'Vencido', perdido: 'Perdido', pendente: 'Em andamento' }

export default function FichaRelatorio({ f, cor }) {
  return (
    <div className="rel-ficha" style={{ borderLeftColor: cor }}>
      <div className="rel-ficha-topo">
        <div className="rel-ficha-tit">{f.titulo}</div>
        <div className="rel-ficha-grid">
          {f.campos.map(([rotulo, valor]) => (
            <div className="rel-campo" key={rotulo}><span className="l">{rotulo}</span><span className="v">{valor}</span></div>
          ))}
          {f.link && (
            <div className="rel-campo"><span className="l">Link</span><span className="v"><a href={f.link} target="_blank" rel="noreferrer">abrir licitação</a></span></div>
          )}
        </div>
        {f.objeto && <p className="rel-ficha-obj"><strong>Objeto:</strong> {f.objeto}</p>}
      </div>

      <div className="rel-ficha-res" style={{ borderColor: f.situacao.cor }}>
        <div className="rel-ficha-sit" style={{ color: f.situacao.cor }}>{f.situacao.texto}</div>
        {f.homologada && <div>Homologada em {f.homologada}</div>}
        {f.motivo && <div>Motivo: {f.motivo}</div>}
        {f.nossoLance && (
          <div>Nosso lance: <strong>{brl(f.nossoLance)}</strong>{f.colocacao ? ` · ${f.colocacao}º lugar` : ''}</div>
        )}
        {!f.nossoLance && f.colocacao && <div>{f.colocacao}º lugar</div>}
        {f.vencedor && (
          <div>
            {f.vencedor.nome
              ? <>{f.vencedor.nome}{f.vencedor.valor ? <> · <strong>{brl(f.vencedor.valor)}</strong></> : null}</>
              : <>1º colocado: <strong>{brl(f.vencedor.valor)}</strong></>}
          </div>
        )}
        {f.valorVencido && <div>Valor que vencemos: <strong style={{ color: '#16A34A' }}>{brl(f.valorVencido)}</strong></div>}
      </div>

      {f.itens.length > 0 && (
        <table className="rel-tabela" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Item</th><th style={{ textAlign: 'right' }}>Qtd.</th><th>Colocação</th><th>Situação</th>
              <th style={{ textAlign: 'right' }}>Vl. estimado</th>
              <th style={{ textAlign: 'right' }}>Nosso valor mínimo</th>
              <th style={{ textAlign: 'right' }}>Valor do 1º colocado</th>
            </tr>
          </thead>
          <tbody>
            {f.itens.map((it, i) => (
              <tr key={i} style={it.situacao === 'ganho' ? { background: '#DCFCE7' } : undefined}>
                <td style={{ maxWidth: 280 }}>{it.numero !== '' ? <strong>{it.numero} · </strong> : null}{it.descricao}</td>
                <td style={{ textAlign: 'right' }}>{it.quantidade || '—'}</td>
                <td>{it.colocacao ? it.colocacao + 'º' : '—'}</td>
                <td style={{ fontWeight: 700, color: COR_SIT[it.situacao] }}>{ROTULO_SIT[it.situacao]}</td>
                <td style={{ textAlign: 'right' }}>{it.estimado ? brl(it.estimado) : 'Sigiloso'}</td>
                <td style={{ textAlign: 'right' }}>{brl(it.nossoValor)}</td>
                <td style={{ textAlign: 'right' }}>
                  {it.primeiro ? brl(it.primeiro) : '—'}
                  {it.vencedorNome ? <div style={{ fontWeight: 400, color: '#64748B' }}>{it.vencedorNome}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {f.observacoes && (
        <div className="rel-ficha-observ"><span className="l">OBSERVAÇÕES</span>{f.observacoes}</div>
      )}
    </div>
  )
}
