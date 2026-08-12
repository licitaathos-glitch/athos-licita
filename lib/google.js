import { google } from 'googleapis'

let _sheets = null

export function getSheets() {
  if (_sheets) return _sheets
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })
  _sheets = google.sheets({ version: 'v4', auth })
  return _sheets
}

// ── Controle de leituras ────────────────────────────────────────────────────
// A cota do Google Sheets é de ~60 leituras por minuto por usuário, e a service
// account inteira conta como UM usuário. Uma única tela dispara várias rotas, e
// várias delas leem as mesmas abas (Empresas aparece em 21 lugares) — sem
// controle, algumas telas seguidas já estouravam a cota e o site respondia
// "Quota exceeded".
//
// Três defesas: cache curto por aba (elas mudam devagar e toda escrita
// invalida a aba na hora), junção de leituras simultâneas da mesma aba numa só
// chamada, e repetição com espera crescente quando o Google devolve 429.
const TTL_CACHE = 15 * 1000
const _cache = new Map()      // aba -> { em, linhas }
const _emVoo = new Map()      // aba -> Promise das linhas cruas

export function invalidarCache(nome) {
  if (nome) { _cache.delete(nome); _emVoo.delete(nome) }
  else { _cache.clear(); _emVoo.clear() }
}

const ehCota = e => e?.code === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(e?.message || '')

export async function comRetry(fn, tentativas = 4) {
  let ultimo
  for (let i = 0; i < tentativas; i++) {
    try { return await fn() } catch (e) {
      ultimo = e
      if (!ehCota(e) || i === tentativas - 1) throw e
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))  // 1s, 2s, 4s
    }
  }
  throw ultimo
}

async function linhasDaAba(nome) {
  const guardado = _cache.get(nome)
  if (guardado && Date.now() - guardado.em < TTL_CACHE) return guardado.linhas
  if (_emVoo.has(nome)) return _emVoo.get(nome)

  const promessa = comRetry(async () => {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: nome + '!A:CZ',
    })
    return res.data.values || []
  })
    .then(linhas => { _cache.set(nome, { em: Date.now(), linhas }); return linhas })
    .finally(() => _emVoo.delete(nome))

  _emVoo.set(nome, promessa)
  return promessa
}

// Le uma aba inteira e devolve array de objetos usando a linha 1 como cabecalho
export async function lerAba(nome) {
  const linhas = await linhasDaAba(nome)
  if (linhas.length < 2) return []
  const h = linhas[0]
  return linhas.slice(1).map(l => {
    const o = {}
    h.forEach((col, i) => { o[col] = l[i] !== undefined ? l[i] : '' })
    return o
  })
}

// Converte índice de coluna (0-based) em letra A1 (0→A, 1→B, ...)
function colLetra(n) {
  let s = ''
  n = n + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// Insere uma nova linha ao final da aba, respeitando a ordem das colunas do cabeçalho
// Ex.: adicionarLinha('Empresas', { id: '5', nome: 'Empresa X', cnpj: '...' })
export async function adicionarLinha(nomeAba, objeto) {
  invalidarCache(nomeAba)
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: nomeAba + '!A:CZ',
  })
  const linhas = res.data.values || []
  const h = linhas[0] || []
  if (!h.length) return { ok: false, erro: 'Não foi possível ler o cabeçalho da aba ' + nomeAba + '.' }

  const linha = h.map(col => (objeto[col] !== undefined ? objeto[col] : ''))

  // Grava no endereço exato da primeira coluna livre em vez de usar append.
  // O append do Google ancora na "tabela" que ele detecta sozinho: se a coluna A
  // estiver vazia (aba com uma coluna sobrando na frente, como a Atas), ele
  // começa a escrever na B e a linha inteira entra deslocada uma coluna — foi o
  // que aconteceu com atas gravadas pelo site, que sumiam da listagem.
  await comRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range: nomeAba + '!A' + (linhas.length + 1),
    valueInputOption: 'RAW',
    requestBody: { values: [linha] },
  }))
  invalidarCache(nomeAba)
  return { ok: true }
}

// Abas já conferidas nesta instância — garantirAba lê os metadados da planilha
// inteira, o que também consome cota. Conferir uma vez basta: aba não deixa de
// existir, e a criação de coluna nova só acontece na primeira vez.
const _abasOk = new Set()

// Garante que a aba existe com o cabeçalho informado; cria se não existir
export async function garantirAba(nomeAba, colunas) {
  if (_abasOk.has(nomeAba)) return { ok: true, criada: false, cache: true }
  invalidarCache(nomeAba)
  const sheets = getSheets()
  const meta = await comRetry(() => sheets.spreadsheets.get({ spreadsheetId: process.env.SHEET_ID }))
  const existe = meta.data.sheets.find(s => s.properties.title === nomeAba)

  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: nomeAba } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: nomeAba + '!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [colunas] },
    })
    _abasOk.add(nomeAba)
    return { ok: true, criada: true }
  }

  // Aba existe — acrescenta colunas que faltarem no fim do cabeçalho
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: nomeAba + '!A1:CZ1',
  })
  const h = (res.data.values && res.data.values[0]) || []
  const faltantes = colunas.filter(c => !h.includes(c))
  if (faltantes.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: nomeAba + '!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [[...h, ...faltantes]] },
    })
  }
  _abasOk.add(nomeAba)
  return { ok: true, criada: false }
}

// Exclui uma linha da aba, localizada pelo valor de uma coluna-chave
export async function excluirLinha(nomeAba, colunaChave, valorChave) {
  invalidarCache(nomeAba)
  const sheets = getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.SHEET_ID })
  const alvoAba = meta.data.sheets.find(s => s.properties.title === nomeAba)
  if (!alvoAba) return { ok: false, erro: 'Aba ' + nomeAba + ' não encontrada.' }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: nomeAba + '!A:CZ',
  })
  const linhas = res.data.values || []
  if (linhas.length < 2) return { ok: false, erro: 'Aba vazia.' }
  const h = linhas[0]
  const idx = h.indexOf(colunaChave)
  if (idx === -1) return { ok: false, erro: 'Coluna ' + colunaChave + ' não existe.' }

  const alvo = String(valorChave).trim()
  for (let i = 1; i < linhas.length; i++) {
    if (String(linhas[i][idx] || '').trim() === alvo) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.SHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: alvoAba.properties.sheetId,
                dimension: 'ROWS',
                startIndex: i,
                endIndex: i + 1,
              },
            },
          }],
        },
      })
      invalidarCache(nomeAba)
      return { ok: true }
    }
  }
  return { ok: false, erro: 'Registro não encontrado.' }
}

// Atualiza células específicas de uma linha, localizada pelo valor de uma coluna-chave
// Ex.: atualizarLinha('Usuarios', 'email', 'x@y.com', { pin: '123456', reset_token: '' })
export async function atualizarLinha(nomeAba, colunaChave, valorChave, updates) {
  invalidarCache(nomeAba)
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: nomeAba + '!A:CZ',
  })
  const linhas = res.data.values || []
  if (linhas.length < 2) return { ok: false, erro: 'Aba vazia.' }
  const h = linhas[0]
  const idxChave = h.indexOf(colunaChave)
  if (idxChave === -1) return { ok: false, erro: 'Coluna ' + colunaChave + ' não existe.' }

  const alvo = String(valorChave).trim().toLowerCase()
  for (let i = 1; i < linhas.length; i++) {
    const v = String(linhas[i][idxChave] || '').trim().toLowerCase()
    if (v === alvo) {
      const data = []
      for (const [col, val] of Object.entries(updates)) {
        const ci = h.indexOf(col)
        if (ci === -1) continue
        data.push({
          range: nomeAba + '!' + colLetra(ci) + (i + 1),
          values: [[val]],
        })
      }
      if (!data.length) return { ok: false, erro: 'Nenhuma coluna válida.' }
      await comRetry(() => sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.SHEET_ID,
        requestBody: { valueInputOption: 'RAW', data },
      }))
      invalidarCache(nomeAba)
      return { ok: true, linha: i + 1 }
    }
  }
  return { ok: false, erro: 'Registro não encontrado.' }
}
