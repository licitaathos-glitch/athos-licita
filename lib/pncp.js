const BASE = 'https://pncp.gov.br/api/consulta/v1/contratacoes'

export { MODALIDADES, UFS } from './pncpConstantes'

const HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; AthosLicita/1.0)',
}

const aaaammdd = d => d.toISOString().slice(0, 10).replace(/-/g, '')
const fmtData = s => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '')

function detectarPortal(link) {
  const l = String(link || '')
  if (/bll/i.test(l)) return 'BLL Compras'
  if (/comprasnet|compras\.gov/i.test(l)) return 'ComprasNet / Compras.gov.br'
  if (/licitanet/i.test(l)) return 'Licitanet'
  if (/bbmnet/i.test(l)) return 'BBMNET'
  if (/bnc\.org|bnccompras/i.test(l)) return 'BNC'
  if (/portaldecompras/i.test(l)) return 'Portal de Compras Públicas'
  try { return l ? l.split('/')[2] : '' } catch { return '' }
}

function normalizar(item, uf) {
  const num = item.numeroControlePNCP || ''
  const situacao = String(item.situacaoCompraNome || '').toLowerCase()
  const valorNum = Number(item.valorTotalEstimado) || 0
  return {
    numeroPNCP: num,
    numeroEdital: item.processo || item.numeroCompra || num,
    objeto: item.objetoCompra || '',
    orgao: item.orgaoEntidade?.razaoSocial || item.orgaoSubRogado?.razaoSocial || '',
    uf: item.unidadeOrgao?.ufSigla || uf || '',
    municipio: item.unidadeOrgao?.municipioNome || '',
    valorNum,
    valor: valorNum ? 'R$ ' + valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
    dataPublicacao: fmtData(item.dataPublicacaoPncp),
    dataAbertura: fmtData(item.dataAberturaProposta),
    dataLimite: fmtData(item.dataEncerramentoProposta),
    modalidade: item.modalidadeNome || '',
    srp: item.srp === true ? 'Sim' : 'Não',
    status: (situacao.includes('divulgada') || situacao.includes('recebendo')) ? 'Aberta' : 'Encerrada',
    portal: detectarPortal(item.linkSistemaOrigem),
    link: item.linkSistemaOrigem || (num ? 'https://pncp.gov.br/app/editais/' + num : ''),
  }
}

// Busca contratações no PNCP. Devolve também um diagnóstico para depuração,
// já que a API costuma limitar chamadas por origem.
export async function buscarPNCP({ dias = 3, ufs = ['RJ'], modalidades = [6, 8], termo = '', maxPaginas = 3 }) {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - (parseInt(dias) || 3))
  const dataFinal = aaaammdd(hoje)
  const dataInicial = aaaammdd(inicio)

  const termoLimpo = String(termo || '').toLowerCase().trim()
  const termos = termoLimpo ? termoLimpo.split(',').map(t => t.trim()).filter(Boolean) : []

  const vistos = new Set()
  const resultados = []
  const diagnostico = []

  for (const mod of modalidades) {
    for (const uf of ufs) {
      let pagina = 1
      let totalPaginas = 1
      while (pagina <= totalPaginas && pagina <= maxPaginas) {
        const url = `${BASE}/publicacao?dataInicial=${dataInicial}&dataFinal=${dataFinal}` +
          `&codigoModalidadeContratacao=${mod}&uf=${uf}&tamanhoPagina=50&pagina=${pagina}`
        try {
          const r = await fetch(url, { headers: HEADERS, cache: 'no-store' })
          if (r.status === 204) { diagnostico.push(`${uf}/mod${mod}: sem resultados`); break }
          if (!r.ok) {
            const corpo = await r.text().catch(() => '')
            diagnostico.push(`${uf}/mod${mod} p${pagina}: HTTP ${r.status} ${corpo.slice(0, 120)}`)
            break
          }
          const json = await r.json()
          const itens = Array.isArray(json) ? json : (json.data || json.content || [])
          if (!itens.length) break
          totalPaginas = json.totalPaginas || json.totalPages || 1

          for (const item of itens) {
            const chave = item.numeroControlePNCP || JSON.stringify(item).slice(0, 60)
            if (vistos.has(chave)) continue
            vistos.add(chave)
            const obj = String(item.objetoCompra || '').toLowerCase()
            if (termos.length && !termos.some(t => obj.includes(t))) continue
            resultados.push(normalizar(item, uf))
          }
          pagina++
        } catch (e) {
          diagnostico.push(`${uf}/mod${mod}: ${e.message}`)
          break
        }
      }
    }
  }

  resultados.sort((a, b) => b.valorNum - a.valorNum)
  return { resultados, diagnostico, periodo: { dataInicial, dataFinal } }
}

// Extrai os dados de uma licitação a partir do link do PNCP
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
    const r = await fetch(urlCompra, { headers: HEADERS, redirect: 'follow', cache: 'no-store' })
    if (!r.ok) {
      return { sucesso: false, erro: `O PNCP respondeu HTTP ${r.status} para esta licitação. Confira o link ou preencha manualmente.` }
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
