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

    // Pedidos de cotação ainda sem resposta do fornecedor — o Dashboard mostra
    // isso num cartão próprio, é a fila que trava a montagem da proposta.
    let cotacoes = []
    try {
      const porId = {}
      licitacoes.forEach(l => { porId[String(l.id).trim()] = l })
      cotacoes = (await lerAba('Cotacoes'))
        .filter(c => c.id && String(c.status || 'Pendente').trim() !== 'Respondida')
        .filter(c => !c.empresaId || permitidas.has(String(c.empresaId).trim()))
        .map(c => {
          const lic = porId[String(c.licitacaoId || '').trim()]
          return {
            id: c.id, licitacaoId: c.licitacaoId || '',
            empresaNome: c.empresaNome || (lic ? lic.empresaNome : ''),
            edital: c.numeroEdital || (lic ? lic.numeroEdital : '') || 'Sem nº',
            destinatario: c.destinatarioEmail || '',
            enviadoEm: c.criadoEm || '',
            objeto: lic ? lic.objeto : '',
          }
        })
    } catch { cotacoes = [] }

    return NextResponse.json({ sucesso: true, licitacoes, cotacoes })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
