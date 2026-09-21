import { NextResponse } from 'next/server'
import { extrairPorLink } from '@/lib/pncp'
import { chamarGAS } from '@/lib/gas'
import { getUsuarioFromReq, podeEditar, podeAcessarMenu } from '@/lib/auth'

export const maxDuration = 60

// O PNCP passou a responder "301 sem Location" para as chamadas que saem da
// Vercel — um redirecionamento sem destino, que não há como seguir. Pela rede
// da Google (Apps Script) a mesma consulta funciona. Então: tenta direto, e se
// falhar, pede ao Apps Script, que já tem a ação extrairDadosPNCP publicada.
// Mesma estratégia que resolveu o download de anexos.
async function viaAppsScript(link) {
  const r = await chamarGAS({ action: 'extrairDadosPNCP', link }, 30)
  if (!r?.sucesso || !r.dados) return { sucesso: false, erro: r?.erro || 'o Apps Script não retornou dados' }

  const d = r.dados
  // O Apps Script devolve os campos com nomes um pouco diferentes da extração
  // direta; aqui eles são alinhados para a tela não precisar saber a origem.
  return {
    sucesso: true,
    via: 'apps-script',
    dados: {
      numeroPNCP: d.numeroPNCP || '',
      numeroEdital: d.numeroEdital || '',
      objeto: d.objeto || '',
      modalidade: d.modalidade || '',
      portal: d.portal || '',
      orgao: d.orgao || '',
      uasg: d.uasg || '',
      uf: d.uf || '',
      valorEstimado: d.valorEstimado || '',
      dataAberturaISO: d.dataAberturaISO || '',
      dataLimiteISO: d.dataLimiteISO || '',
      srp: d.srp || 'Não',
      link: d.linkPortal || link,
      itens: (d.itens || []).map((it, i) => ({
        numero: it.numero ?? it.numeroItem ?? String(i + 1),
        descricao: it.descricao || '',
        quantidade: it.quantidade || '',
        unidade: it.unidade || 'UN',
        valorUnitarioRef: it.valorUnitarioRef ?? '',
        grupo: it.grupo || '',
      })),
    },
  }
}

export async function POST(req) {
  try {
    const usuario = await getUsuarioFromReq(req)
    if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
    if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
    if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

    const { link } = await req.json()
    if (!link) return NextResponse.json({ sucesso: false, erro: 'Informe o link do PNCP.' })

    const direto = await extrairPorLink(link)
    if (direto.sucesso) return NextResponse.json(direto)

    // Link mal formado não melhora mudando de caminho — devolve o erro direto
    if (/Link não reconhecido/.test(direto.erro || '')) return NextResponse.json(direto)

    try {
      const alternativo = await viaAppsScript(link)
      if (alternativo.sucesso) return NextResponse.json(alternativo)
      return NextResponse.json({
        ...direto,
        erro: `${direto.erro} Tentei também pelo Apps Script e não deu: ${alternativo.erro}.`,
      })
    } catch (e) {
      return NextResponse.json({ ...direto, erro: `${direto.erro} O caminho alternativo também falhou: ${e.message}` })
    }
  } catch (e) {
    // Rede de segurança: nunca deixar o Next devolver a página de erro crua —
    // sempre um JSON, com o erro real, para dar pra diagnosticar pela tela.
    return NextResponse.json({ sucesso: false, erro: 'Erro interno: ' + (e && e.message ? e.message : String(e)) }, { status: 500 })
  }
}
