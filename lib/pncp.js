import { montarConsultas, consolidar, detectarPortal, PNCP_BASE } from './pncpComum'
export { MODALIDADES, UFS } from './pncpComum'

const HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; AthosLicita/1.0)',
}

const espera = ms => new Promise(r => setTimeout(r, ms))

// Busca no PNCP a partir do servidor. Pode falhar com HTTP 429 porque o IP de
// saída da Vercel é compartilhado — nesse caso o front refaz a busca pelo navegador.
export async function buscarPNCP({ dias = 3, ufs = ['RJ'], modalidades = [6, 8], termo = '' }) {
  const { consultas, periodo } = montarConsultas({ dias, ufs, modalidades })
  const brutos = []
  const diagnostico = []
  let houve429 = false

  for (const c of consultas) {
    let pagina = 1
    let totalPaginas = 1
    let tentativas = 0
    while (pagina <= totalPaginas && pagina <= c.maxPaginas) {
      try {
        const r = await fetch(c.urlDe(pagina), { headers: HEADERS, cache: 'no-store' })
        if (r.status === 204) { diagnostico.push(`${c.uf}/mod${c.mod}: sem resultados`); break }
        if (r.status === 429) {
          houve429 = true
          if (tentativas < 2) { tentativas++; await espera(1500 * tentativas); continue }
          diagnostico.push(`${c.uf}/mod${c.mod}: HTTP 429 (limite por IP do servidor)`)
          break
        }
        if (!r.ok) {
          const corpo = await r.text().catch(() => '')
          diagnostico.push(`${c.uf}/mod${c.mod} p${pagina}: HTTP ${r.status} ${corpo.slice(0, 100)}`)
          break
        }
        const json = await r.json()
        const itens = Array.isArray(json) ? json : (json.data || json.content || [])
        if (!itens.length) break
        totalPaginas = json.totalPaginas || json.totalPages || 1
        itens.forEach(item => brutos.push({ item, uf: c.uf }))
        pagina++
        await espera(250)
      } catch (e) {
        diagnostico.push(`${c.uf}/mod${c.mod}: ${e.message}`)
        break
      }
    }
  }

  return { resultados: consolidar(brutos, termo), diagnostico, periodo, houve429 }
}

export async function extrairPorLink(link) {
  let cnpj = '', ano = '', seq = ''
  const m1 = String(link).match(/editais\/(\d{14})\/(\d{4})\/(\d+)/)
  if (m1) { cnpj = m1[1]; ano = m1[2]; seq = m1[3] }
  if (!cnpj) {
    const m2 = String(link).match(/(\d{14})-\d+-(\d+)\/(\d{4})/)
    if (m2) { cnpj = m2[1]; seq = String(parseInt(m2[2])); ano = m2[3] }
  }
  if (!cnpj || !ano || !seq) {
    return { sucesso: false, erro: 'Link não reconhecido. Use o formato pncp.gov.br/app/editais/CNPJ/ANO/SEQUENCIAL.' }
  }

  const urlCompra = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`
  try {
    let r
    for (let t = 0; t < 3; t++) {
      r = await fetch(urlCompra, { headers: HEADERS, redirect: 'follow', cache: 'no-store' })
      if (r.status !== 429) break
      await espera(1500 * (t + 1))
    }
    if (!r.ok) {
      return {
        sucesso: false,
        erro: r.status === 429
          ? 'O PNCP recusou por limite de requisições no servidor. Tente novamente em alguns instantes ou preencha manualmente.'
          : `O PNCP respondeu HTTP ${r.status}. Confira o link ou preencha manualmente.`,
      }
    }
    const d = await r.json()

    let itens = []
    try {
      const ri = await fetch(urlCompra + '/itens?pagina=1&tamanhoPagina=100', { headers: HEADERS, cache: 'no-store' })
      if (ri.ok) {
        const arr = await ri.json()
        const lista = Array.isArray(arr) ? arr : (arr.data || [])
        itens = lista.map(it => ({
          descricao: it.descricao || '',
          quantidade: it.quantidade || '',
          unidade: it.unidadeMedida?.nomeSingular || it.unidadeMedida || 'UN',
          valorUnitarioRef: it.valorUnitarioEstimado || '',
        }))
      }
    } catch { /* itens são opcionais */ }

    const toISO = s => {
      const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2}:\d{2})?/)
      return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00:00'}` : ''
    }

    return { sucesso: true, dados: {
      numeroPNCP: d.numeroControlePNCP || `${cnpj}-1-${seq}/${ano}`,
      numeroEdital: d.numeroCompra ? `${d.numeroCompra}/${ano}` : (d.processo || ''),
      objeto: d.objetoCompra || '',
      modalidade: d.modalidadeNome || '',
      portal: detectarPortal(d.linkSistemaOrigem),
      orgao: d.orgaoEntidade?.razaoSocial || '',
      uf: d.unidadeOrgao?.ufSigla || '',
      valorEstimado: d.valorTotalEstimado || '',
      dataAberturaISO: toISO(d.dataAberturaProposta),
      dataLimiteISO: toISO(d.dataEncerramentoProposta),
      srp: d.srp === true ? 'Sim' : 'Não',
      link: d.linkSistemaOrigem || link,
      itens,
    }}
  } catch (e) {
    return { sucesso: false, erro: 'Erro ao consultar o PNCP: ' + e.message }
  }
}
