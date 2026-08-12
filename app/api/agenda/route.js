import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { getUsuarioFromReq, empresasVisiveis } from '@/lib/auth'
import { faseAutomatica, faseInferida } from '@/lib/fases'

// Agenda de sessões — versão enxuta da lista de licitações, sem itens nem
// checklist, para o Dashboard carregar rápido. A janela de dias é calculada
// no navegador, que é quem sabe o fuso de quem está olhando.
export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    const todasEmpresas = await lerAba('Empresas')
    const permitidas = new Set(empresasVisiveis(usuario, todasEmpresas.filter(e => e.id)).map(e => String(e.id).trim()))

    const licitacoes = (await lerAba('Licitacoes'))
      .filter(l => l.id && (!l.empresaId || permitidas.has(String(l.empresaId).trim())))
      .map(l => ({
        id: l.id,
        empresaId: l.empresaId || '', empresaNome: l.empresaNome || '',
        numeroEdital: l.numeroEdital || l.numeroPNCP || 'Sem nº',
        objeto: String(l.objeto || '').slice(0, 140),
        orgao: l.orgao || '', uf: l.uf || '', portal: l.portal || '',
        valor: l.valor || '', srp: l.srp || '',
        // Mesma regra da tela de licitações, para as fases não divergirem
        fase: faseAutomatica({
          fase: faseInferida({ fase: l.fase, resultado: l.resultado, participar: l.participar, status: l.status }),
          dataSessao: l.dataSessao, dataLimite: l.dataLimite, dataAbertura: l.dataAbertura,
        }),
        status: l.status || 'Aberta',
        quando: l.dataSessao || l.dataLimite || l.dataAbertura || '',
        origemQuando: l.dataSessao ? 'sessão' : (l.dataLimite ? 'limite da proposta' : 'abertura'),
      }))
      .filter(l => l.quando && !['Finalizada', 'Descartado'].includes(l.fase))

    return NextResponse.json({ sucesso: true, licitacoes })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
