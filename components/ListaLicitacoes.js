'use client'
import { useState } from 'react'
import { FASES, normalizarFase } from '@/lib/fases'
import { nomeResultado, corResultado } from '@/lib/resultado'

// Visão em abas: as fases ficam no topo com a contagem e os processos
// só aparecem depois que a fase é escolhida.
export default function ListaLicitacoes({ licitacoes, onAbrir, faseInicial }) {
  const [faseAtiva, setFaseAtiva] = useState(faseInicial || FASES[0].id)

  const porFase = {}
  FASES.forEach(f => { porFase[f.id] = [] })
  licitacoes.forEach(l => {
    const f = normalizarFase(l.fase || 'Em analise')
    if (porFase[f]) porFase[f].push(l)
  })

  const lista = porFase[faseAtiva] || []
  const cor = FASES.find(f => f.id === faseAtiva)?.cor || '#1B2E4B'

  return (
    <div>
      <div className="abas-fase">
        {FASES.map(f => (
          <button key={f.id}
            className={'aba-fase' + (faseAtiva === f.id ? ' on' : '')}
            style={faseAtiva === f.id ? { borderBottomColor: f.cor } : undefined}
            onClick={() => setFaseAtiva(f.id)}>
            {f.nome}
            <span className="aba-cont" style={{ background: f.cor }}>{porFase[f.id].length}</span>
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <div style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0' }}>
          Nenhuma licitação nesta fase.
        </div>
      )}

      {lista.map(l => (
        <div className="linha-lic" key={l.id} style={{ borderLeftColor: cor }} onClick={() => onAbrir(l)}>
          <div className="col1">
            <div className="lic-num">
              {l.numeroEdital || 'Sem nº'}
              {l.srp === 'Sim' && <span className="pill pill-gray" style={{ marginLeft: 6 }}>SRP</span>}
            </div>
            <div className="lic-obj">{String(l.objeto || '').slice(0, 120)}</div>
            <div className="lic-meta">
              {l.empresa_nome}{l.orgao ? ' · ' + l.orgao : ''}{l.uf ? '/' + l.uf : ''}
              {l.modalidade ? ' · ' + l.modalidade : ''}{l.portal ? ' · ' + l.portal : ''}
            </div>
          </div>

          <div className="lic-campo">
            <span className="lic-campo-lbl">DATA DA SESSÃO</span>
            <span className="lic-campo-val">{l.dataSessao || l.dataLimite || l.dataAbertura || '—'}</span>
          </div>

          <div className="lic-campo">
            <span className="lic-campo-lbl">VALOR ESTIMADO</span>
            <span className="lic-campo-val">{l.valor || '—'}</span>
          </div>

          <div className="lic-campo">
            <span className="lic-campo-lbl">ITENS</span>
            <span className="lic-campo-val">{l.itens?.length || 0}</span>
          </div>

          <div className="lic-campo">
            <span className="lic-campo-lbl">FASE</span>
            <span className="pill" style={{ background: cor + '22', color: cor }}>
              {FASES.find(f => f.id === faseAtiva)?.nome}
            </span>
          </div>

          {l.resultado && l.resultado !== 'Aguardando' && (
            <div className="lic-campo">
              <span className="lic-campo-lbl">RESULTADO</span>
              <span className="lic-campo-val" style={{ color: corResultado(l.resultado) }}>
                {nomeResultado(l.resultado)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
