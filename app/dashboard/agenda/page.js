'use client'
import { Suspense } from 'react'
import CalendarioGeral from '@/components/CalendarioGeral'
import PainelAgenda from '@/components/PainelAgenda'

// A agenda ganhou menu próprio porque no Dashboard ela disputava espaço com o
// resto e ainda carregava seis APIs numa tela que deveria abrir instantânea.
export default function AgendaPage() {
  return (
    <div>
      <h2 className="sec-title">Agenda</h2>
      <p className="sec-sub">Sessões, prazos, certidões, atas, recebimentos, eventos e tarefas</p>

      <div style={{ marginBottom: 26 }}>
        <h3 className="sec-title" style={{ fontSize: 16 }}>⚖️ Licitações do dia e da semana</h3>
        <Suspense fallback={null}><PainelAgenda /></Suspense>
      </div>

      <Suspense fallback={null}><CalendarioGeral /></Suspense>
    </div>
  )
}
