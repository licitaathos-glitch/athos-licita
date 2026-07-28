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

// Le uma aba inteira e devolve array de objetos usando a linha 1 como cabecalho
export async function lerAba(nome) {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: nome + '!A:CZ',
  })
  const linhas = res.data.values || []
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
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: nomeAba + '!A1:CZ1',
  })
  const h = (res.data.values && res.data.values[0]) || []
  if (!h.length) return { ok: false, erro: 'Não foi possível ler o cabeçalho da aba ' + nomeAba + '.' }

  const linha = h.map(col => (objeto[col] !== undefined ? objeto[col] : ''))
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: nomeAba + '!A:CZ',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [linha] },
  })
  return { ok: true }
}

// Garante que a aba existe com o cabeçalho informado; cria se não existir
export async function garantirAba(nomeAba, colunas) {
  const sheets = getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.SHEET_ID })
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
  return { ok: true, criada: false }
}

// Exclui uma linha da aba, localizada pelo valor de uma coluna-chave
export async function excluirLinha(nomeAba, colunaChave, valorChave) {
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
      return { ok: true }
    }
  }
  return { ok: false, erro: 'Registro não encontrado.' }
}

// Atualiza células específicas de uma linha, localizada pelo valor de uma coluna-chave
// Ex.: atualizarLinha('Usuarios', 'email', 'x@y.com', { pin: '123456', reset_token: '' })
export async function atualizarLinha(nomeAba, colunaChave, valorChave, updates) {
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
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.SHEET_ID,
        requestBody: { valueInputOption: 'RAW', data },
      })
      return { ok: true, linha: i + 1 }
    }
  }
  return { ok: false, erro: 'Registro não encontrado.' }
}
