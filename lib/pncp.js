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
export async function buscarPNCP({ dias = 3, ufs = ['RJ'], modalidades = [6, 8], termo = '', uasg = '', cnpjOrgao = '' }) {
  const { consultas, periodo } = montarConsultas({ dias, ufs, modalidades, uasg, cnpjOrgao })
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
// Nunca deixa uma única chamada ficar pendurada esperando resposta —
// se o PNCP não responder em 8s, desiste dessa tentativa e segue adiante,
// em vez de arriscar a função inteira ser matada pela Vercel por timeout.
async function fetchComLimite(url, opcoes = {}, limiteMs = 8000) {
  const controlador = new AbortController()
  const timer = setTimeout(() => controlador.abort(), limiteMs)
  try {
    return await fetch(url, { ...opcoes, signal: controlador.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function buscarSeguindo(url) {
  let r, ultimoErro = '', urlFinal = url
  for (let t = 0; t < 2; t++) {
    urlFinal = url
    try {
      r = await fetchComLimite(urlFinal, { headers: HEADERS, redirect: 'manual', cache: 'no-store' }, 9000)

      // O PNCP responde 301 nesses endereços e o "redirect: follow" do Node não
      // estava seguindo (a resposta voltava como 301 mesmo), então a extração
      // falhava sem tentar o destino. Seguimos o Location na mão, no máximo
      // três saltos, e guardamos onde parou para o diagnóstico.
      let saltos = 0
      while (r && [301, 302, 303, 307, 308].includes(r.status) && saltos < 3) {
        const destino = r.headers.get('location')
        if (!destino) break
        const proxima = new URL(destino, urlFinal).toString()
        if (proxima === urlFinal) break // redireciona para si mesmo: não adianta insistir
        urlFinal = proxima
        saltos++
        r = await fetchComLimite(urlFinal, { headers: HEADERS, redirect: 'manual', cache: 'no-store' }, 9000)
      }
    } catch (e) {
      r = null // esgotou o tempo ou a conexão falhou — trata como "sem resposta"
      ultimoErro = e.name === 'AbortError' ? 'timeout' : (e.cause?.message || e.cause?.code || e.message || 'falha de conexão')
    }
    if (r && r.status !== 429) break
    if (t < 1) await espera(700) // tenta de novo tanto em 429 quanto em timeout/sem resposta
  }
  return { resposta: r || null, urlFinal, erro: ultimoErro }
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
    `https://pncp.gov.br/pncp-api/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`,
    `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`,
    `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}`,
  ]

  const inicio = Date.now()
  // Nunca deixa a extração como um todo passar disso — a Vercel mata a
  // função aos 60s sem dó, então paramos bem antes e devolvemos o que já
  // temos (mesmo sem os itens) em vez de arriscar não devolver nada.
  const dentroDoPrazo = () => Date.now() - inicio < 25000

  try {
    let r = null, urlCompra = caminhos[0]
    const tentados = []
    for (const candidato of caminhos) {
      if (!dentroDoPrazo()) { tentados.push('tempo esgotado antes de terminar de tentar os endereços da compra'); break }
      const { resposta, urlFinal, erro: erroConexao } = await buscarSeguindo(candidato)
      if (resposta && resposta.ok) { r = resposta; urlCompra = urlFinal; break }
      const destino = urlFinal !== candidato ? ` (redirecionou para ${urlFinal.replace('https://pncp.gov.br', '')})` : ''
      tentados.push(`${candidato.replace('https://pncp.gov.br', '')} → HTTP ${resposta ? resposta.status : 'sem resposta (' + (erroConexao || 'falha de conexão') + ')'}${destino}`)
    }

    if (!r) {
      // Distingue os três casos, porque a saída é diferente em cada um:
      // 404 = o link aponta para algo que o PNCP não tem nessa rota;
      // 429 = limite de requisições, basta esperar;
      // sem resposta = instabilidade de rede entre a Vercel e o PNCP.
      const status429 = tentados.some(t => t.includes('429'))
      const so404 = tentados.length > 0 && tentados.every(t => t.includes('404'))
      const semResposta = tentados.some(t => t.includes('sem resposta'))
      return {
        sucesso: false,
        erro: status429
          ? 'O PNCP recusou por limite de requisições. Espere um minuto e tente de novo.'
          : so404
            ? 'O PNCP não tem essa contratação no endereço do link (erro 404). Confira o número no link — CNPJ do órgão, ano e sequencial.'
            : semResposta
              ? 'O PNCP não respondeu (instabilidade da rede, não é problema do link). Tente de novo em alguns instantes; os dados já preenchidos continuam valendo.'
              : 'Não foi possível obter os dados no PNCP. Confira o link ou preencha manualmente.',
        detalhe: tentados,
      }
    }
    const d = await r.json()

    // Itens: tenta o host que já funcionou para a compra, e o outro host como
    // alternativa — sem repetir o mesmo endereço à toa (isso só custa tempo)
    let itens = []
    const diagItens = []
    const outroHost = urlCompra === caminhos[0] ? caminhos[1] : caminhos[0]
    const rotasItens = dentroDoPrazo() ? [
      urlCompra + '/itens?pagina=1&tamanhoPagina=500',
      outroHost + '/itens?pagina=1&tamanhoPagina=500',
    ] : []
    if (!rotasItens.length) diagItens.push('tempo esgotado antes de buscar os itens — dados básicos extraídos, preencha os itens manualmente ou tente novamente')
    for (const rota of rotasItens) {
      if (!dentroDoPrazo()) { diagItens.push('tempo esgotado — parou de tentar mais rotas'); break }
      try {
        const { resposta: ri } = await buscarSeguindo(rota)
        if (!ri || !ri.ok) { diagItens.push(`${rota.replace('https://pncp.gov.br', '')} → HTTP ${ri ? ri.status : 'sem resposta'}`); continue }
        const arr = await ri.json()
        const lista = Array.isArray(arr) ? arr : (arr.data || arr.content || arr.itens || [])
        if (!lista.length) { diagItens.push(`${rota.replace('https://pncp.gov.br', '')} → vazio`); continue }
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
        break
      } catch (e) {
        diagItens.push(`${rota.replace('https://pncp.gov.br', '')} → ${e.message}`)
      }
    }

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
      uasg: d.unidadeOrgao?.codigoUnidade || d.orgaoSubRogado?.codigoUnidade || '',
      uf: d.unidadeOrgao?.ufSigla || '',
      valorEstimado: d.valorTotalEstimado || '',
      dataAberturaISO: toISO(d.dataAberturaProposta),
      dataLimiteISO: toISO(d.dataEncerramentoProposta),
      srp: d.srp === true ? 'Sim' : 'Não',
      link: d.linkSistemaOrigem || link,
      itens,
      diagItens,
    }}
  } catch (e) {
    // Mesmo no erro inesperado, devolve o que já foi tentado — sem isso a tela
    // mostra só a mensagem genérica e não dá para saber o que aconteceu.
    return { sucesso: false, erro: 'Erro ao consultar o PNCP: ' + e.message, detalhe: [`${cnpj}/${ano}/${parseInt(seq)}`] }
  }
}
