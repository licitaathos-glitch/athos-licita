import { NextResponse } from 'next/server'
import { extrairPorLink } from '@/lib/pncp'
import { getUsuarioFromReq, podeEditar, podeAcessarMenu } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req) {
  try {
    const usuario = await getUsuarioFromReq(req)
    if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
    if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
    if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

    const { link } = await req.json()
    if (!link) return NextResponse.json({ sucesso: false, erro: 'Informe o link do PNCP.' })
    return NextResponse.json(await extrairPorLink(link))
  } catch (e) {
    // Rede de segurança: nunca deixar o Next devolver a página de erro crua —
    // sempre um JSON, com o erro real, para dar pra diagnosticar pela tela.
    return NextResponse.json({ sucesso: false, erro: 'Erro interno: ' + (e && e.message ? e.message : String(e)) }, { status: 500 })
  }
}
