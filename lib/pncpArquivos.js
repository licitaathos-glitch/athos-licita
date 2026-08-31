// Busca de documentos publicados no PNCP — propositalmente separado de
// lib/pncp.js (extração principal) para que uma falha ou demora aqui NUNCA
// afete objeto/itens/valor, que já funcionam de forma confiável.
const HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; AthosLicita/1.0)',
}

// Nunca deixa uma chamada ficar pendurada esperando resposta do PNCP —
// se não responder em 8s, desiste dessa tentativa (mesmo ajuste que
// resolveu o travamento na extração principal).
async function buscarComLimite(url, opcoes = {}, limiteMs = 8000) {
  const controlador = new AbortController()
  const timer = setTimeout(() => controlador.abort(), limiteMs)
  try {
    return await fetch(url, { ...opcoes, signal: controlador.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Mesmo problema da extração: o PNCP responde 301 nesses endereços e o
// "redirect: follow" do Node não estava seguindo. Segue o Location na mão.
async function seguirRedirecionamento(url) {
  let atual = url
  let r = await buscarComLimite(atual, { headers: HEADERS, redirect: 'manual', cache: 'no-store' })
  let saltos = 0
  while (r && [301, 302, 303, 307, 308].includes(r.status) && saltos < 3) {
    const destino = r.headers.get('location')
    if (!destino) break
    const proxima = new URL(destino, atual).toString()
    if (proxima === atual) break
    atual = proxima
    saltos++
    r = await buscarComLimite(atual, { headers: HEADERS, redirect: 'manual', cache: 'no-store' })
  }
  return r
}

async function tentarUmaVez(url) {
  try {
    const r = await seguirRedirecionamento(url)
    if (!r.ok) return { erro: `HTTP ${r.status}` }
    const arr = await r.json()
    const lista = Array.isArray(arr) ? arr : (arr.data || [])
    if (!lista.length) return { erro: 'vazio' }
    return { lista }
  } catch (e) {
    return { erro: e.name === 'AbortError' ? 'sem resposta em 8s' : e.message }
  }
}

// Recebe o CNPJ/ano/sequencial já extraídos e tenta os dois hosts do PNCP
// que publicam documentos, em paralelo, com um único tiro cada (sem os
// retries pesados da extração principal — aqui, se falhar, só o anexo
// automático fica de fora, e a licitação já foi extraída normalmente).
export async function buscarArquivosPNCP({ cnpj, ano, seq }) {
  const bases = [
    `https://pncp.gov.br/pncp-api/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`,
    `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`,
  ]

  const resultados = await Promise.allSettled(
    bases.map(base => tentarUmaVez(base + '/arquivos?pagina=1&tamanhoPagina=50').then(r => ({ base, ...r })))
  )

  const tentativas = []
  for (const res of resultados) {
    if (res.status !== 'fulfilled') { tentativas.push('erro: ' + (res.reason?.message || res.reason)); continue }
    const { base, lista, erro } = res.value
    if (erro) { tentativas.push(`${base.replace('https://pncp.gov.br', '')} → ${erro}`); continue }
    const arquivos = lista.map(a => {
      const seqDoc = a.sequencialDocumento ?? a.sequencial ?? ''
      let url = a.url || a.uri || (seqDoc !== '' ? `${base}/arquivos/${seqDoc}` : '')
      // Às vezes a API devolve só o caminho, sem o domínio — completa aqui
      if (url && !/^https?:\/\//i.test(url)) url = 'https://pncp.gov.br' + (url.startsWith('/') ? '' : '/') + url
      return {
        titulo: a.titulo || a.tipoDocumentoNome || a.tipoDocumentoDescricao || a.nomeArquivo || 'Documento',
        nomeArquivo: a.nomeArquivo || a.titulo || 'documento.pdf',
        url,
      }
    }).filter(a => a.url)
    if (arquivos.length) return { sucesso: true, arquivos }
  }
  return { sucesso: false, erro: tentativas.join(' · ') || 'PNCP não tem documentos publicados para esta licitação.' }
}

// Extrai {cnpj, ano, seq} do link do edital, na mesma lógica da extração principal
export function parseLinkPNCP(link) {
  let cnpj = '', ano = '', seq = ''
  const m1 = String(link).match(/editais\/(\d{14})\/(\d{4})\/(\d+)/)
  if (m1) { cnpj = m1[1]; ano = m1[2]; seq = m1[3] }
  if (!cnpj) {
    const m2 = String(link).match(/(\d{14})-\d+-(\d+)\/(\d{4})/)
    if (m2) { cnpj = m2[1]; seq = String(parseInt(m2[2])); ano = m2[3] }
  }
  return cnpj && ano && seq ? { cnpj, ano, seq } : null
}
