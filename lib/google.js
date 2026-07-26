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
    range: nome + '!A:Z',
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
