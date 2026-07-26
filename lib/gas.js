// Ponte para o Apps Script — usado apenas onde o Drive é necessário.
// A conta de serviço não tem cota de armazenamento própria, então o upload
// de arquivos continua sendo feito pelo Apps Script (que grava no Drive do Adriano).
const GAS_URL = process.env.GAS_URL ||
  'https://script.google.com/macros/s/AKfycbzNxs1SOrYbZ1amVbRrCqa-w43R1hdIT56sgRMmlgINO4ROukWnogWUEX9FsVnfDbfn/exec'

export async function chamarGAS(payload) {
  const r = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
  const texto = await r.text()
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error('Resposta inesperada do Apps Script: ' + texto.slice(0, 200))
  }
}
