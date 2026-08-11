'use client'
import { enviarAoGAS } from './gasClient'

// Anexa um documento publicado no PNCP, tentando dois caminhos de rede
// diferentes até um funcionar:
//
//   1) servidor da Vercel (/api/licitacoes/anexar-pncp) — mais rápido, mas o
//      link Vercel -> pncp.gov.br vive caindo ("Connect Timeout");
//   2) Apps Script (Google) — o próprio GAS baixa o arquivo do PNCP com
//      UrlFetchApp e grava no Drive. Sai pela rede da Google, que é outro
//      caminho, e não sofre CORS porque é servidor-para-servidor.
//
// Baixar pelo navegador do usuário foi testado e NÃO funciona: o PNCP não
// manda cabeçalho CORS no download do arquivo, então o navegador bloqueia.
// Por isso esse caminho foi removido — não adianta reintroduzir.
//
// Retorna sempre o mesmo formato da rota do servidor:
//   { sucesso, id, url, nome, via: 'servidor' | 'apps-script', erro }

function ehFalhaDeRede(erro = '') {
  return /timeout|fetch failed|não respondeu|sem resposta|conexão|network|ECONNRESET|ETIMEDOUT|HTTP 5\d\d/i.test(erro)
}

// Caminho 2: quem baixa do PNCP é o Apps Script, não a Vercel nem o navegador.
async function anexarPeloAppsScript({ url, nomeArquivo, empresaNome }) {
  const r = await enviarAoGAS({
    action: 'baixarAnexoPNCP',
    url,
    nomeArquivo: nomeArquivo || 'documento.pdf',
    empresaNome: empresaNome || 'Geral',
  })
  if (!r || !r.ok) throw new Error((r && r.erro) || 'o Apps Script não conseguiu baixar.')
  return {
    sucesso: true,
    id: r.driveFileId,
    url: r.driveFileUrl,
    nome: r.nomeArquivo || nomeArquivo,
    via: 'apps-script',
  }
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

  // Erro de permissão, URL inválida ou arquivo grande demais: trocar de rede
  // não resolve, então nem tenta.
  if (!ehFalhaDeRede(erroServidor)) return { sucesso: false, erro: erroServidor }

  try {
    return await anexarPeloAppsScript({ url, nomeArquivo, empresaNome })
  } catch (e) {
    return { sucesso: false, erro: `Vercel: ${erroServidor} · Apps Script: ${e.message}` }
  }
}
