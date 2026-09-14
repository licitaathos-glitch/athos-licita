import { NextResponse } from 'next/server'
import { chamarGAS } from '@/lib/gas'
import { getUsuarioFromReq } from '@/lib/auth'

export const maxDuration = 60

// Entrega o PDF de atas e certidões para quem está logado no Athos Licita.
// Os arquivos ficam PRIVADOS no Drive pessoal, então só o dono conseguia
// abri-los — qualquer outro usuário via a tela de acesso negado do Google, e
// mesmo o dono esbarrava nisso quando o navegador estava em outra conta.
// Aqui quem busca é o Apps Script (dono dos arquivos) e quem autoriza é o
// nosso login. O Drive continua privado.
export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url') || ''
  const id = searchParams.get('id') || ''
  const baixar = searchParams.get('baixar') === '1'
  if (!url && !id) return NextResponse.json({ erro: 'Arquivo não informado.' }, { status: 400 })

  try {
    const r = await chamarGAS({ action: 'baixarArquivoDrive', driveFileId: id, driveFileUrl: url }, 50)
    if (!r?.ok) {
      return NextResponse.json({ erro: r?.erro || 'Não foi possível abrir o arquivo.', driveFileUrl: r?.driveFileUrl }, { status: 502 })
    }

    const bytes = Buffer.from(r.base64, 'base64')
    const nome = String(r.nomeArquivo || 'documento.pdf').replace(/"/g, '')
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': r.mimeType || 'application/pdf',
        // inline abre no visualizador; attachment força o download
        'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}
