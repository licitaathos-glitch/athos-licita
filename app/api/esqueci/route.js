import { NextResponse } from 'next/server'

const GAS_URL = process.env.GAS_URL ||
  'https://script.google.com/macros/s/AKfycbzNxs1SOrYbZ1amVbRrCqa-w43R1hdIT56sgRMmlgINO4ROukWnogWUEX9FsVnfDbfn/exec'

export async function POST(req) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ sucesso: false, erro: 'Informe o e-mail.' })

    const r = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'solicitarReset', email }),
      redirect: 'follow',
    })
    const dados = await r.json()
    return NextResponse.json(dados)
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao solicitar código: ' + e.message })
  }
}
