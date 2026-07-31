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
        const { resposta: r } = await buscarSeguindo(c.urlDe(pagina))
        if (!r) { diagnostico.push(`${c.uf}/mod${c.mod}: sem resposta do PNCP`); break }
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


// O PNCP responde 301/302 em vários endpoints. Alguns ambientes não seguem
// automaticamente (ou perdem os cabeçalhos no salto), então seguimos na mão.
async function buscarSeguindo(url, tentativas = 3) {
  let atual = url
  for (let i = 0; i < tentativas; i++) {
    let r
    for (let t = 0; t < 2; t++) {
      r = await fetch(atual, { headers: HEADERS, redirect: 'manual', cache: 'no-store' })
      if (r.status !== 429) break
      await espera(700 * (t + 1))
    }
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const loc = r.headers.get('location')
      if (!loc) return { resposta: r, urlFinal: atual }
      atual = loc.startsWith('http') ? loc : new URL(loc, 'https://pncp.gov.br').toString()
      continue
    }
    return { resposta: r, urlFinal: atual }
  }
  return { resposta: null, urlFinal: atual, erro: 'Excesso de redirecionamentos.' }
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

  const caminhos = [
    `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`,
    `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`,
  ]

  try {
    let r = null, urlCompra = caminhos[0]
    const tentados = []
    const resultadosCompra = await Promise.allSettled(caminhos.map(c => buscarSeguindo(c)))
    resultadosCompra.forEach((res, i) => {
      const resposta = res.status === 'fulfilled' ? res.value.resposta : null
      if (!r && resposta && resposta.ok) { r = resposta; urlCompra = caminhos[i] }
      else tentados.push(`${caminhos[i].replace('https://pncp.gov.br', '')} → HTTP ${resposta ? resposta.status : 'sem resposta'}`)
    })

    if (!r) {
      const status429 = tentados.some(t => t.includes('429'))
      return {
        sucesso: false,
        erro: status429
          ? 'O PNCP recusou por limite de requisições. Tente de novo em alguns instantes ou preencha manualmente.'
          : 'Não foi possível obter os dados no PNCP. Confira o link ou preencha manualmente.',
        detalhe: tentados,
      }
    }
    const d = await r.json()

    // Itens: o PNCP expõe em caminhos e formatos diferentes conforme a origem,
    // então tentamos algumas variações em paralelo antes de desistir
    let itens = []
    const diagItens = []
    const rotasItens = [
      urlCompra + '/itens?pagina=1&tamanhoPagina=500',
      urlCompra + '/itens',
      `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}/itens?pagina=1&tamanhoPagina=500`,
      `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}/itens?pagina=1&tamanhoPagina=500`,
    ]
    const resultadosItens = await Promise.allSettled(rotasItens.map(async rota => {
      const { resposta: ri } = await buscarSeguindo(rota)
      if (!ri || !ri.ok) return { rota, erro: `HTTP ${ri ? ri.status : 'sem resposta'}` }
      const arr = await ri.json()
      const lista = Array.isArray(arr) ? arr : (arr.data || arr.content || arr.itens || [])
      if (!lista.length) return { rota, erro: 'vazio' }
      return { rota, lista }
    }))
    for (const res of resultadosItens) {
      if (res.status !== 'fulfilled') { diagItens.push(`erro: ${res.reason?.message || res.reason}`); continue }
      const { rota, lista, erro } = res.value
      if (erro) { diagItens.push(`${rota.replace('https://pncp.gov.br', '')} → ${erro}`); continue }
      if (!itens.length) {
        itens = lista.map(it => ({
          numero: it.numeroItem ?? it.numero ?? '',
          // Licitações por grupo/lote: o PNCP nem sempre expõe isso de forma
          // padronizada, então tentamos os nomes de campo mais prováveis —
          // se nenhum vier preenchido, o campo fica em branco para preencher à mão
          grupo: it.grupo ?? it.numeroGrupo ?? it.tituloGrupo ?? it.grupoNome ?? '',
          descricao: it.descricao || it.descricaoItem || it.materialOuServicoNome || '',
          quantidade: it.quantidade ?? it.quantidadeItem ?? '',
          unidade: it.unidadeMedida?.nomeSingular || it.unidadeMedida || it.unidadeFornecimento || 'UN',
          valorUnitarioRef: it.valorUnitarioEstimado ?? it.valorUnitario ?? '',
        }))
      }
    }

    // Arquivos publicados (edital, termo de referência, anexos). O PNCP
    // expõe documentos por um host de API diferente do usado para os dados
    // da compra (pncp-api/v1, em vez de api/pncp/v1) — tentamos os dois em
    // paralelo, para não somar o tempo de espera de cada um.
    let arquivos = []
    let diagArquivos = ''
    const basesArquivos = [
      `https://pncp.gov.br/pncp-api/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`,
      urlCompra,
    ]
    const resultadosArquivos = await Promise.allSettled(basesArquivos.map(async base => {
      const { resposta: ra } = await buscarSeguindo(base + '/arquivos?pagina=1&tamanhoPagina=50')
      if (!ra) return { base, erro: 'sem resposta' }
      if (!ra.ok) return { base, erro: `HTTP ${ra.status}` }
      const arr = await ra.json()
      const lista = Array.isArray(arr) ? arr : (arr.data || [])
      if (!lista.length) return { base, erro: 'vazio' }
      return { base, lista }
    }))
    const tentadosArquivos = []
    for (const res of resultadosArquivos) {
      if (res.status !== 'fulfilled') { tentadosArquivos.push(`erro: ${res.reason?.message || res.reason}`); continue }
      const { base, lista, erro } = res.value
      if (erro) { tentadosArquivos.push(`${base.replace('https://pncp.gov.br', '')} → ${erro}`); continue }
      if (!arquivos.length) {
        arquivos = lista.map(a => {
          const seqDoc = a.sequencialDocumento ?? a.sequencial ?? ''
          return {
            titulo: a.titulo || a.tipoDocumentoNome || a.tipoDocumentoDescricao || a.nomeArquivo || 'Documento',
            nomeArquivo: a.nomeArquivo || a.titulo || 'documento.pdf',
            url: a.url || a.uri || (seqDoc !== '' ? `${base}/arquivos/${seqDoc}` : ''),
            sequencial: seqDoc,
          }
        }).filter(a => a.url)
      }
    }
    if (!arquivos.length) diagArquivos = tentadosArquivos.join(' · ') || 'PNCP não tem documentos publicados para esta licitação.'

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
      arquivos,
      diagItens,
      diagArquivos,
    }}
  } catch (e) {
    return { sucesso: false, erro: 'Erro ao consultar o PNCP: ' + e.message }
  }
}
