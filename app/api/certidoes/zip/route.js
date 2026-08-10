import { NextResponse } from 'next/server'
import { getUsuarioFromReq, podeAcessarMenu, empresasComMenu } from '@/lib/auth'
import { lerAba } from '@/lib/google'
import { chamarGAS } from '@/lib/gas'

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'certidoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso.' }, { status: 403 })

  const { empresaId } = await req.json()
  if (!empresaId) return NextResponse.json({ sucesso: false, erro: 'Selecione uma empresa.' })

  // Confere que o usuário realmente tem acesso a essa empresa antes de gerar o zip
  const todas = await lerAba('Empresas')
  const permitidas = empresasComMenu(usuario, 'certidoes', todas.filter(e => e.id))
  if (!permitidas.some(e => String(e.id).trim() === String(empresaId).trim())) {
    return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })
  }

  try {
    const r = await chamarGAS({ action: 'baixarZipEmpresa', empresaId })
    if (!r || r.ok === false || r.erro) {
      return NextResponse.json({ sucesso: false, erro: (r && r.erro) || 'Não foi possível gerar o zip.' })
    }
    return NextResponse.json({ sucesso: true, base64: r.base64, nomeArquivo: r.nomeArquivo, totalDocs: r.totalDocs })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
