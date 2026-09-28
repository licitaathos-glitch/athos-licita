import { NextResponse } from 'next/server'
import { chamarGAS } from '@/lib/gas'
import { getUsuarioFromReq } from '@/lib/auth'
import { analisarLinkDrive } from '@/lib/drive'

export const maxDuration = 60

// A Vercel recusa resposta de função acima de ~4,5 MB. Acima disso o arquivo
// não passa por aqui e a pessoa é levada ao Drive.
const LIMITE_BYTES = 4.3 * 1024 * 1024

const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Página legível dentro do próprio visualizador. Antes qualquer falha aparecia
// como um JSON cru ({"erro":"..."}) dentro do quadro, sem dizer o que fazer.
function aviso(titulo, texto, { link, valor } = {}) {
  const html = `<!doctype html><meta charset="utf-8"><body style="font-family:-apple-system,Segoe UI,sans-serif;padding:26px;color:#2E2D2F;max-width:640px">
    <h3 style="margin:0 0 8px;color:#B45309">${esc(titulo)}</h3>
    <p style="font-size:14px;line-height:1.55;margin:0 0 12px">${texto}</p>
    ${valor ? `<p style="font-size:12px;color:#64748B;word-break:break-all;background:#F8FAFC;padding:8px 10px;border-radius:8px;margin:0 0 12px"><strong>Link guardado:</strong> ${esc(valor)}</p>` : ''}
    ${link ? `<p style="margin:0"><a href="${esc(link)}" target="_blank" rel="noreferrer" style="color:#145653;font-weight:700">↗ Abrir o link em outra aba</a></p>` : ''}
  </body>`
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// Entrega o PDF de atas e certidões para quem está logado no Athos Licita.
// Os arquivos ficam PRIVADOS no Drive; quem busca é o Apps Script (dono dos
// arquivos) e quem autoriza é o login do sistema.
export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const url = (searchParams.get('url') || '').trim()
  const idParam = (searchParams.get('id') || '').trim()
  const baixar = searchParams.get('baixar') === '1'

  // O id gravado no documento vale mais que o link, que pode estar em qualquer formato
  let id = idParam
  if (!id) {
    const info = analisarLinkDrive(url)
    if (info.tipo === 'arquivo') id = info.id
    else if (info.tipo === 'vazio') return aviso('Documento sem arquivo', 'Este registro não tem nenhum arquivo guardado. Use <strong>Atualizar</strong> e anexe o PDF.')
    else if (info.tipo === 'pasta') return aviso('O link guardado é de uma pasta', 'Não dá para exibir uma pasta inteira aqui. Use <strong>Atualizar</strong> e anexe o PDF deste documento.', { link: url, valor: url })
    else if (info.tipo === 'externo') return aviso('O link guardado não é do Google Drive', 'Ele aponta para outro site, então o sistema não consegue trazer o arquivo. Abra o link, baixe o PDF e use <strong>Atualizar</strong> para anexá-lo aqui.', { link: url, valor: url })
    else return aviso('Link do arquivo inválido', 'O que está guardado não é um endereço reconhecível. Use <strong>Atualizar</strong> e anexe o PDF novamente.', { valor: url })
  }

  try {
    const r = await chamarGAS({ action: 'baixarArquivoDrive', driveFileId: id, driveFileUrl: url }, 50)
    if (!r?.ok) {
      return aviso('Não consegui abrir o arquivo no Drive',
        esc(r?.erro || 'O Apps Script não respondeu.') + '<br><br>Se o arquivo foi apagado ou movido no Drive, use <strong>Atualizar</strong> e anexe o PDF de novo.',
        { link: r?.driveFileUrl || url || undefined })
    }

    const bytes = Buffer.from(r.base64, 'base64')
    if (bytes.length > LIMITE_BYTES) {
      return aviso('Arquivo grande demais para exibir aqui',
        'Este PDF passa de 4 MB e não cabe na visualização do sistema. Abra pelo Drive.',
        { link: r.driveFileUrl || url || `https://drive.google.com/file/d/${id}/view` })
    }

    const nome = String(r.nomeArquivo || 'documento.pdf').replace(/"/g, '')
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': r.mimeType || 'application/pdf',
        'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    return aviso('Erro ao buscar o arquivo', esc(e.message))
  }
}
