import { NextResponse } from 'next/server'
import { buscarArquivosPNCP, parseLinkPNCP } from '@/lib/pncpArquivos'
import { getUsuarioFromReq, podeEditar, podeAcessarMenu } from '@/lib/auth'

export const maxDuration = 30

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

    return NextResponse.json(await buscarArquivosPNCP(partes))
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro interno: ' + (e && e.message ? e.message : String(e)) }, { status: 500 })
  }
}
