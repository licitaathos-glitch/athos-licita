import { NextResponse } from 'next/server'
import { lerAba, cabecalhoAba } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin } from '@/lib/auth'

// Página de diagnóstico. Existe porque "o campo não salva" pode ter três causas
// bem diferentes — build antiga no ar, coluna com nome divergente na planilha,
// ou dado gravado que a tela não mostra — e sem ver a planilha por dentro não
// dá para saber qual é. Abra /api/diagnostico no navegador, logado.
export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ erro: 'Só administrador.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  try {
    const cabecalho = (await cabecalhoAba('Licitacoes')).map((c, i) => `${i}: ${JSON.stringify(c)}`)
    const linhas = await lerAba('Licitacoes')

    // Colunas de data: nome exato, para flagrar espaço sobrando ou caixa trocada
    const esperadas = ['dataAbertura', 'dataLimite', 'dataSessao', 'dataPublicacao']
    const cru = await cabecalhoAba('Licitacoes')
    const conferencia = esperadas.map(nome => ({
      coluna: nome,
      existe: cru.includes(nome),
      parecidas: cru.filter(c => c !== nome && String(c).trim().toLowerCase() === nome.toLowerCase()),
    }))

    const alvo = id
      ? linhas.find(l => String(l.id || '').trim() === String(id).trim())
      : linhas[linhas.length - 1]

    return NextResponse.json({
      versaoNoAr: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'desconhecida',
      publicadoEm: process.env.VERCEL_GIT_COMMIT_MESSAGE?.slice(0, 90) || '',
      totalLicitacoes: linhas.length,
      conferenciaColunasDeData: conferencia,
      cabecalhoDaAba: cabecalho,
      licitacaoInspecionada: alvo ? {
        id: alvo.id,
        numeroEdital: alvo.numeroEdital,
        dataAbertura: alvo.dataAbertura ?? null,
        dataLimite: alvo.dataLimite ?? null,
        dataSessao: alvo.dataSessao ?? null,
      } : 'nenhuma linha encontrada',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}
