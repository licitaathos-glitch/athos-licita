// Ponte para o Apps Script — usado apenas onde o Drive é necessário.
// A conta de serviço não tem cota de armazenamento própria, então o upload
// de arquivos continua sendo feito pelo Apps Script (que grava no Drive do Adriano).
const GAS_URL = process.env.GAS_URL ||
  'https://script.google.com/macros/s/AKfycbzNxs1SOrYbZ1amVbRrCqa-w43R1hdIT56sgRMmlgINO4ROukWnogWUEX9FsVnfDbfn/exec'

// Timeout próprio: sem ele, uma leitura demorada no Apps Script (vários PDFs
// no Gemini) segurava a função da Vercel até o limite dela, que devolvia uma
// resposta vazia — e a tela mostrava "Unexpected end of JSON input", que não
// diz nada a quem está usando.
export async function chamarGAS(payload, segundos = 45) {
  const controlador = new AbortController()
  const timer = setTimeout(() => controlador.abort(), segundos * 1000)
  let r
  try {
    r = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controlador.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`O Apps Script demorou mais de ${segundos}s para responder. Tente com menos arquivos.`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }

  const texto = await r.text()
  if (!texto.trim()) throw new Error('O Apps Script devolveu uma resposta vazia. Confira se a implantação está publicada na versão mais recente.')
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error('Resposta inesperada do Apps Script: ' + texto.slice(0, 200))
  }
}
