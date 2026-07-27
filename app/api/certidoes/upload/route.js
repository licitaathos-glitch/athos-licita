import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { chamarGAS } from '@/lib/gas'
import { getUsuarioFromReq, podeEditar, empresasVisiveis, podeAcessarMenu } from '@/lib/auth'

// A extração via Gemini pode levar até ~40s
export const maxDuration = 60

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'certidoes')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { base64, mimeType, nomeArquivo, empresa_id, tipo_slug } = await req.json()
    if (!base64 || !empresa_id) return NextResponse.json({ sucesso: false, erro: 'Arquivo e empresa são obrigatórios.' })

    // Confere se o usuário tem acesso a essa empresa
    const todas = await lerAba('Empresas')
    const permitidas = empresasVisiveis(usuario, todas.filter(e => e.id))
    const empresa = permitidas.find(e => String(e.id).trim() === String(empresa_id).trim())
    if (!empresa) return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })

    // O Apps Script grava no Drive e roda a extração via Gemini
    const r = await chamarGAS({
      action: 'uploadCertidao',
      base64, mimeType: mimeType || 'application/pdf',
      nomeArquivo: nomeArquivo || 'documento.pdf',
      empresaId: empresa_id, nomeEmpresa: empresa.nome,
      tipoSlug: tipo_slug || '',
    })

    return NextResponse.json({
      sucesso: true,
      driveFileId: r.driveFileId || '',
      driveFileUrl: r.driveFileUrl || '',
      dados: r.ok ? (r.dados || null) : null,
      avisoGemini: r.ok ? null : (r.erro || 'Não foi possível ler o documento automaticamente.'),
    })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no upload: ' + e.message }, { status: 500 })
  }
}
