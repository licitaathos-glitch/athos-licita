import { NextResponse } from 'next/server'
import { buscarPNCP } from '@/lib/pncp'
import { getUsuarioFromReq } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    const { dias, ufs, modalidades, termo } = await req.json()
    const r = await buscarPNCP({
      dias: dias || 3,
      ufs: (ufs && ufs.length) ? ufs : ['RJ'],
      modalidades: (modalidades && modalidades.length) ? modalidades : [6, 8],
      termo: termo || '',
    })

    if (!r.resultados.length && r.houve429) {
      return NextResponse.json({
        sucesso: false,
        limitado: true,
        erro: 'O PNCP recusou a consulta feita pelo servidor (limite por IP compartilhado).',
        diagnostico: r.diagnostico.slice(0, 6),
      })
    }

    return NextResponse.json({
      sucesso: true, via: 'servidor',
      total: r.resultados.length,
      oportunidades: r.resultados.slice(0, 300),
      diagnostico: r.diagnostico.slice(0, 6),
      periodo: r.periodo,
    })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro na busca: ' + e.message }, { status: 500 })
  }
}
