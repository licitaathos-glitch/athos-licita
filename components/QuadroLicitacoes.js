'use client'
import { useState } from 'react'
import { FASES } from '@/lib/fases'
import { nomeResultado, corResultado } from '@/lib/resultado'

const diasAte = dataBR => {
  const m = String(dataBR || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T23:59:00`)
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return Math.ceil((d - h) / 86400000)
}

export default function QuadroLicitacoes({ licitacoes, somenteConsulta, onMover, onAbrir, onExcluir, podeExcluir }) {
  const [arrastando, setArrastando] = useState(null)
  const [alvo, setAlvo] = useState(null)

  const porFase = {}
  FASES.forEach(f => { porFase[f.id] = [] })
  licitacoes.forEach(l => { (porFase[l.fase] || porFase['Em analise']).push(l) })

  function soltar(faseId) {
    if (arrastando && arrastando.fase !== faseId) onMover(arrastando, faseId)
    setArrastando(null); setAlvo(null)
  }

  return (
    <div className="quadro">
      {FASES.map(f => {
        const cards = porFase[f.id] || []
        return (
          <div
            key={f.id}
            className={'coluna' + (alvo === f.id ? ' alvo' : '')}
            onDragOver={e => { e.preventDefault(); setAlvo(f.id) }}
            onDragLeave={() => setAlvo(a => a === f.id ? null : a)}
            onDrop={() => soltar(f.id)}
          >
            <div className="col-hdr" style={{ borderTopColor: f.cor }}>
              <div className="col-nome">
                {f.nome}
                <span className="col-qtd" style={{ background: f.cor }}>{cards.length}</span>
              </div>
              <div className="col-desc">{f.desc}</div>
            </div>

            <div className="col-cards">
              {cards.length === 0 && <div className="col-vazia">—</div>}
              {cards.map(l => {
                const dd = diasAte(l.dataLimite)
                const urgente = dd !== null && dd >= 0 && dd <= 3
                return (
                  <div
                    key={l.id}
                    className={'card-lic' + (urgente ? ' urgente' : '')}
                    draggable={!somenteConsulta}
                    onDragStart={() => setArrastando(l)}
                    onDragEnd={() => { setArrastando(null); setAlvo(null) }}
                    onClick={() => onAbrir(l)}
                  >
                    <div className="card-edital">{l.numeroEdital || 'Sem nº'}</div>
                    <div className="card-obj">{String(l.objeto || '').slice(0, 95)}</div>
                    <div className="card-orgao">{l.orgao}{l.uf ? '/' + l.uf : ''}</div>
                    {(l.dataSessao || l.dataLimite || l.dataAbertura) && (
                      <div className="card-data">
                        🗓 {l.dataSessao || l.dataLimite || l.dataAbertura}
                      </div>
                    )}

                    <div className="card-rodape">
                      {l.valor && <span className="card-valor">{l.valor}</span>}
                      {dd !== null && dd >= 0 && f.id !== 'Finalizada' && f.id !== 'Descartado' && (
                        <span className={'card-prazo' + (urgente ? ' urg' : '')}>
                          {dd === 0 ? 'hoje' : dd + 'd'}
                        </span>
                      )}
                    </div>

                    {l.resultado && l.resultado !== 'Aguardando' && (
                      <div className="card-resultado" style={{ color: corResultado(l.resultado) }}>
                        {nomeResultado(l.resultado)}
                      </div>
                    )}

                    {!somenteConsulta && (
                      <div className="card-mover" onClick={e => e.stopPropagation()}>
                        {podeExcluir && (
                          <button className="card-excluir" title="Excluir licitação"
                            onClick={() => onExcluir(l)}>🗑 excluir</button>
                        )}
                      </div>
                    )}

                    {!somenteConsulta && (
                      <div className="card-setas" onClick={e => e.stopPropagation()}>
                        <button title="Fase anterior" disabled={FASES.findIndex(x => x.id === f.id) === 0}
                          onClick={() => {
                            const i = FASES.findIndex(x => x.id === f.id)
                            if (i > 0) onMover(l, FASES[i - 1].id)
                          }}>‹</button>
                        <button title="Próxima fase" disabled={FASES.findIndex(x => x.id === f.id) === FASES.length - 1}
                          onClick={() => {
                            const i = FASES.findIndex(x => x.id === f.id)
                            if (i < FASES.length - 1) onMover(l, FASES[i + 1].id)
                          }}>›</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
