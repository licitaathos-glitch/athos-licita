import { NextResponse } from 'next/server'
import { chamarGAS } from '@/lib/gas'
import { getUsuarioFromReq } from '@/lib/auth'
import { analisarLinkDrive } from '@/lib/drive'

export const maxDuration = 60

// A Vercel recusa resposta de função acima de ~4,5 MB. Acima disso o arquivo
// não passa por aqui e a pessoa é levada ao Drive.
const LIMITE_BYTES = 4.3 * 1024 * 1024

const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Página legível — dentro do quadro de visualização, ou (Baixar/Abrir em nova
// aba) sozinha numa aba própria. Antes qualquer falha aparecia como um JSON
// cru ({"erro":"..."}) sem dizer o que houve nem o que fazer; com o link de
// Baixar agora abrindo em aba nova, essa página passou a ser tudo o que a
// pessoa vê quando algo falha — por isso o visual precisa deixar claro que é
// o Athos Licita avisando um problema, não a aba/app quebrado.
function aviso(titulo, texto, { link, valor } = {}) {
  const html = `<!doctype html><meta charset="utf-8">
  <title>${esc(titulo)} — Athos Licita</title>
  <body style="margin:0;font-family:-apple-system,Segoe UI,sans-serif;background:#F3EFE7;color:#2E2D2F">
    <div style="background:#145653;padding:16px 24px">
      <span style="color:#B9A06B;font-weight:800;font-size:12px;letter-spacing:.08em">ATHOS LICITA</span>
    </div>
    <div style="max-width:640px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:22px">⚠️</span>
        <h3 style="margin:0;color:#B45309;font-size:17px">${esc(titulo)}</h3>
      </div>
      <p style="font-size:14px;line-height:1.6;margin:0 0 14px">${texto}</p>
      ${valor ? `<p style="font-size:12px;color:#64748B;word-break:break-all;background:#fff;padding:10px 12px;border-radius:8px;margin:0 0 14px;border:1px solid #E7E1D5"><strong>Link guardado:</strong> ${esc(valor)}</p>` : ''}
      ${link ? `<p style="margin:0 0 18px"><a href="${esc(link)}" target="_blank" rel="noreferrer" style="color:#145653;font-weight:700">↗ Abrir o link em outra aba</a></p>` : ''}
      <p style="font-size:12px;color:#94A3B8;margin:0">Pode fechar esta aba e voltar para o sistema — nada foi perdido, só este arquivo não pôde ser aberto agora.</p>
    </div>
  </body>`
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// Entrega o PDF de atas e certidões para quem está logado no Athos Licita.
// Os arquivos ficam PRIVADOS no Drive; quem busca é o Apps Script (dono dos
// arquivos) e quem autoriza é o login do sistema.
export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  // Mesmo aqui, aviso() legível em vez de JSON cru — sessão expirada no meio
  // do uso é rara, mas quando acontece precisa ser tão clara quanto o resto
  if (!usuario) return aviso('Sessão expirada', 'Faça login de novo no Athos Licita e tente abrir o arquivo outra vez.')

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
