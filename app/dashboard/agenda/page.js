'use client'
import { Suspense } from 'react'
import CalendarioGeral from '@/components/CalendarioGeral'

// A Agenda ficou sendo só o calendário. O que é lista de trabalho — hoje, em
// andamento, futuras, pendências — voltou para o Dashboard, que é onde se
// decide o que fazer; aqui é onde se enxerga o mês.
export default function AgendaPage() {
  return (
    <div>
      <h2 className="sec-title">Agenda</h2>
      <p className="sec-sub">Sessões, prazos, certidões, atas, recebimentos, eventos e tarefas no calendário</p>
      <Suspense fallback={null}><CalendarioGeral /></Suspense>
    </div>
  )
}
