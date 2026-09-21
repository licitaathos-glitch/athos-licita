import { NextResponse } from 'next/server'
import { buscarArquivosPNCP, parseLinkPNCP, montarArquivos } from '@/lib/pncpArquivos'
import { chamarGAS } from '@/lib/gas'
import { getUsuarioFromReq, podeEditar, podeAcessarMenu } from '@/lib/auth'

export const maxDuration = 60

// Rota independente da extração principal — só busca os documentos.
// Se falhar ou demorar, não afeta em nada objeto/itens/valor já extraídos.
export async function POST(req) {
  try {
    const usuario = await getUsuarioFromReq(req)
    if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
    if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })
    if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

    const { link } = await req.json()
    const partes = parseLinkPNCP(link || '')
    if (!partes) return NextResponse.json({ sucesso: false, erro: 'Link não reconhecido.' })

    const direto = await buscarArquivosPNCP(partes)
    if (direto.sucesso) return NextResponse.json(direto)

    // Mesmo problema da extração: o PNCP responde "301 sem Location" para a
    // Vercel. A lista de documentos é buscada pela rede da Google.
    try {
      const base = `https://pncp.gov.br/pncp-api/v1/orgaos/${partes.cnpj}/compras/${partes.ano}/${parseInt(partes.seq)}`
      const r = await chamarGAS({ action: 'buscarJsonPNCP', url: base + '/arquivos?pagina=1&tamanhoPagina=50' }, 30)
      if (r?.ok) {
        const lista = Array.isArray(r.dados) ? r.dados : (r.dados?.data || [])
        const arquivos = montarArquivos(lista, base)
        if (arquivos.length) return NextResponse.json({ sucesso: true, arquivos, via: 'apps-script' })
      }
      return NextResponse.json({ ...direto, erro: `${direto.erro} · pelo Apps Script: ${r?.erro || 'sem documentos'}` })
    } catch (e) {
      return NextResponse.json({ ...direto, erro: `${direto.erro} · caminho alternativo falhou: ${e.message}` })
    }
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro interno: ' + (e && e.message ? e.message : String(e)) }, { status: 500 })
  }
}
