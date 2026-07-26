'use client'

let _url = null

// Busca (uma vez) o endereço do Apps Script e envia o payload direto do navegador.
// Content-Type text/plain evita preflight de CORS, que o Apps Script não responde.
export async function enviarAoGAS(payload) {
  if (!_url) {
    const r = await fetch('/api/gas-url').then(x => x.json())
    if (!r.sucesso) throw new Error(r.erro || 'Sem permissão para enviar arquivos.')
    _url = r.url
  }
  const resp = await fetch(_url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
  const texto = await resp.text()
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error('Resposta inesperada do Apps Script. Verifique se a implantação está publicada como "Qualquer pessoa".')
  }
}

// Converte um File em base64 puro (sem o prefixo data:)
export function lerBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = () => rej(new Error('Não foi possível ler o arquivo.'))
    r.readAsDataURL(file)
  })
}
