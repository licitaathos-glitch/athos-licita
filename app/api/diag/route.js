import { NextResponse } from 'next/server'
import { getSheets } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin } from '@/lib/auth'

// Rota temporária de diagnóstico: lista as abas da planilha e o cabeçalho de cada uma.
// Não expõe dados das linhas — apenas nomes de colunas. Somente Adm.
export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Somente administradores.' }, { status: 403 })

  try {
    const sheets = getSheets()
    const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.SHEET_ID })
    const nomes = meta.data.sheets.map(s => s.properties.title)

    const resultado = {}
    for (const nome of nomes) {
      try {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SHEET_ID,
          range: nome + '!A1:Z2',
        })
        const linhas = r.data.values || []
        resultado[nome] = {
          colunas: linhas[0] || [],
          exemplo: linhas[1] || [],
        }
      } catch (e) {
        resultado[nome] = { erro: e.message }
      }
    }
    return NextResponse.json({ sucesso: true, abas: nomes, detalhe: resultado })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
