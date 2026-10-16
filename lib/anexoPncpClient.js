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

// HTTP 30x entra aqui: a Vercel recebe do PNCP um "301 sem destino" e não tem
// para onde seguir, mas pelo Apps Script (rede da Google) o mesmo download
// funciona — antes esse erro encerrava a tentativa sem usar o caminho alternativo.
function ehFalhaDeRede(erro = '') {
  return /timeout|fetch failed|não respondeu|sem resposta|conexão|network|ECONNRESET|ETIMEDOUT|tempo esgotado|HTTP (5\d\d|30\d|408|429)/i.test(erro)
}

// Nada aqui pode ficar pendurado: passado o prazo, devolve erro e a fila segue.
function comLimite(promessa, ms, mensagem) {
  let t
  const prazo = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(mensagem)), ms) })
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(t))
}

// Caminho 2: quem baixa do PNCP é o Apps Script, não a Vercel nem o navegador.
async function anexarPeloAppsScript({ url, nomeArquivo, empresaNome }) {
  const r = await comLimite(enviarAoGAS({
    action: 'baixarAnexoPNCP',
    url,
    nomeArquivo: nomeArquivo || 'documento.pdf',
    empresaNome: empresaNome || 'Geral',
  }), 100000, 'o Apps Script demorou mais de 100 s (tempo esgotado)')
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
    const r = await comLimite(fetch('/api/licitacoes/anexar-pncp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, nomeArquivo, empresaNome }),
    }).then(x => x.json()), 65000, 'o servidor não respondeu em 65 s (tempo esgotado)')
    if (r.sucesso) return { ...r, via: 'servidor' }
    erroServidor = r.erro || 'erro desconhecido'
  } catch (e) {
    erroServidor = e && /tempo esgotado/.test(e.message) ? e.message : 'conexão com o servidor'
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
