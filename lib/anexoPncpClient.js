'use client'
import { enviarAoGAS } from './gasClient'

// Anexa um documento publicado no PNCP, com dois caminhos:
//   1) servidor (/api/licitacoes/anexar-pncp) — mais rápido quando funciona;
//   2) navegador do usuário — usado quando o servidor da Vercel não consegue
//      alcançar o pncp.gov.br ("Connect Timeout", "fetch failed").
// O navegador sai por outro IP e costuma passar onde a Vercel trava. O arquivo
// vai direto do navegador para o Apps Script, sem passar pela Vercel.
//
// Retorna sempre o mesmo formato da rota do servidor:
//   { sucesso, id, url, nome, via: 'servidor' | 'navegador', erro }

const LIMITE_MB = 25

function ehFalhaDeRede(erro = '') {
  return /timeout|fetch failed|não respondeu|sem resposta|conexão|network|ECONNRESET|ETIMEDOUT/i.test(erro)
}

function completarExtensao(nome, mime = '') {
  let n = nome || 'documento.pdf'
  if (!/\.[a-z0-9]{2,5}$/i.test(n)) {
    if (mime.includes('pdf')) n += '.pdf'
    else if (mime.includes('zip')) n += '.zip'
    else if (mime.includes('word')) n += '.docx'
  }
  return n
}

function blobParaBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = () => rej(new Error('Não foi possível ler o arquivo baixado.'))
    r.readAsDataURL(blob)
  })
}

// Baixa o documento aqui no navegador e manda pro Drive via Apps Script.
async function anexarPeloNavegador({ url, nomeArquivo, empresaNome }) {
  const controlador = new AbortController()
  const timer = setTimeout(() => controlador.abort(), 45000)
  let resp
  try {
    resp = await fetch(url, {
      headers: { Accept: '*/*' },
      redirect: 'follow',
      cache: 'no-store',
      signal: controlador.signal,
    })
  } catch (e) {
    // Falha de rede a partir do navegador quase sempre é bloqueio de CORS
    throw new Error(
      e.name === 'AbortError'
        ? 'O PNCP não respondeu a tempo (pelo navegador).'
        : 'O navegador não conseguiu baixar do PNCP (possível bloqueio de CORS).'
    )
  } finally {
    clearTimeout(timer)
  }
  if (!resp.ok) throw new Error(`O PNCP respondeu HTTP ${resp.status} (pelo navegador).`)

  const blob = await resp.blob()
  if (!blob.size) throw new Error('O arquivo veio vazio.')
  if (blob.size > LIMITE_MB * 1024 * 1024) {
    throw new Error(`Arquivo maior que ${LIMITE_MB} MB — baixe manualmente e anexe.`)
  }

  const mime = (blob.type || 'application/pdf').split(';')[0]
  const nome = completarExtensao(nomeArquivo, mime)
  const up = await enviarAoGAS({
    action: 'uploadAnexoEdital',
    base64: await blobParaBase64(blob),
    mimeType: mime,
    nomeArquivo: nome,
    empresaNome: empresaNome || 'Geral',
  })
  if (!up || !up.ok) throw new Error((up && up.erro) || 'Falha ao gravar no Drive.')

  return { sucesso: true, id: up.driveFileId, url: up.driveFileUrl, nome, via: 'navegador' }
}

export async function anexarArquivoPNCP({ url, nomeArquivo, empresaNome }) {
  let erroServidor = ''
  try {
    const r = await fetch('/api/licitacoes/anexar-pncp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, nomeArquivo, empresaNome }),
    }).then(x => x.json())
    if (r.sucesso) return { ...r, via: 'servidor' }
    erroServidor = r.erro || 'erro desconhecido'
  } catch {
    erroServidor = 'conexão com o servidor'
  }

  // Se o problema foi de permissão/validação, não adianta tentar pelo navegador.
  if (!ehFalhaDeRede(erroServidor)) return { sucesso: false, erro: erroServidor }

  try {
    return await anexarPeloNavegador({ url, nomeArquivo, empresaNome })
  } catch (e) {
    return { sucesso: false, erro: `${erroServidor} · pelo navegador também falhou: ${e.message}` }
  }
}
