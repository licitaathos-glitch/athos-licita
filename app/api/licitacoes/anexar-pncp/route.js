import { NextResponse } from 'next/server'
import { chamarGAS } from '@/lib/gas'
import { getUsuarioFromReq, podeEditar, podeAcessarMenu } from '@/lib/auth'

export const maxDuration = 60

// Baixa um documento publicado no PNCP e grava na pasta da empresa no Drive.
// O download é feito aqui no servidor; o Apps Script só recebe o arquivo pronto.
export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Sem acesso ao módulo.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { url, nomeArquivo, empresaNome } = await req.json()
    if (!url) return NextResponse.json({ sucesso: false, erro: 'URL do documento não informada.' })
    if (!/^https:\/\/pncp\.gov\.br\//.test(url)) {
      return NextResponse.json({ sucesso: false, erro: 'Só é possível baixar documentos do próprio PNCP.' })
    }

    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AthosLicita/1.0)' },
      redirect: 'follow', cache: 'no-store',
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: `O PNCP respondeu HTTP ${r.status} ao baixar o arquivo.` })

    const buffer = Buffer.from(await r.arrayBuffer())
    if (buffer.length > 25 * 1024 * 1024) {
      return NextResponse.json({ sucesso: false, erro: 'Arquivo maior que 25 MB — baixe manualmente e anexe.' })
    }

    const tipo = r.headers.get('content-type') || 'application/pdf'
    // Preserva a extensão sugerida pelo cabeçalho, quando o nome vier sem ela
    let nome = nomeArquivo || 'documento.pdf'
    if (!/\.[a-z0-9]{2,5}$/i.test(nome)) {
      if (tipo.includes('pdf')) nome += '.pdf'
      else if (tipo.includes('zip')) nome += '.zip'
      else if (tipo.includes('word')) nome += '.docx'
    }

    const up = await chamarGAS({
      action: 'uploadAnexoEdital',
      base64: buffer.toString('base64'),
      mimeType: tipo.split(';')[0],
      nomeArquivo: nome,
      empresaNome: empresaNome || 'Geral',
    })
    if (!up || !up.ok) return NextResponse.json({ sucesso: false, erro: (up && up.erro) || 'Falha ao gravar no Drive.' })

    return NextResponse.json({ sucesso: true, nome, url: up.driveFileUrl, id: up.driveFileId })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao anexar: ' + e.message }, { status: 500 })
  }
}
