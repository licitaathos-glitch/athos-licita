// Constantes e funções puras do PNCP — usadas no servidor e no navegador
export const PNCP_BASE = 'https://pncp.gov.br/api/consulta/v1/contratacoes'

export const MODALIDADES = [
  { cod: 6, nome: 'Pregão Eletrônico' },
  { cod: 8, nome: 'Concorrência Eletrônica' },
  { cod: 7, nome: 'Pregão Presencial' },
  { cod: 9, nome: 'Concorrência Presencial' },
  { cod: 4, nome: 'Dispensa' },
  { cod: 5, nome: 'Inexigibilidade' },
]

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export const aaaammdd = d => d.toISOString().slice(0, 10).replace(/-/g, '')
export const fmtData = s => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '')

export function detectarPortal(link) {
  const l = String(link || '')
  if (/bll/i.test(l)) return 'BLL Compras'
  if (/comprasnet|compras\.gov/i.test(l)) return 'ComprasNet / Compras.gov.br'
  if (/licitanet/i.test(l)) return 'Licitanet'
  if (/bbmnet/i.test(l)) return 'BBMNET'
  if (/bnc\.org|bnccompras/i.test(l)) return 'BNC'
  if (/portaldecompras/i.test(l)) return 'Portal de Compras Públicas'
  try { return l ? l.split('/')[2] : '' } catch { return '' }
}

export function normalizar(item, uf) {
  const num = item.numeroControlePNCP || ''
  const situacao = String(item.situacaoCompraNome || '').toLowerCase()
  const valorNum = Number(item.valorTotalEstimado) || 0
  return {
    numeroPNCP: num,
    numeroEdital: item.processo || item.numeroCompra || num,
    objeto: item.objetoCompra || '',
    orgao: item.orgaoEntidade?.razaoSocial || item.orgaoSubRogado?.razaoSocial || '',
    uasg: item.unidadeOrgao?.codigoUnidade || item.orgaoSubRogado?.codigoUnidade || '',
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

// Monta a lista de URLs a consultar — mesma lógica no servidor e no navegador.
// Com uasg (codigoUnidadeAdministrativa) ou cnpjOrgao a consulta deixa de varrer
// UFs: vai direto na unidade. É assim que se acha uma licitação cuja disputa
// acontece em Licitar Digital, Portal de Compras Públicas etc. — o processo é
// publicado no PNCP de todo jeito (Lei 14.133), só não temos o link dele.
export function montarConsultas({ dias = 3, ufs = ['RJ'], modalidades = [6, 8], maxPaginas = 2, uasg = '', cnpjOrgao = '' }) {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - (parseInt(dias) || 3))
  const dataFinal = aaaammdd(hoje)
  const dataInicial = aaaammdd(inicio)

  const unidade = String(uasg || '').replace(/\D/g, '')
  const cnpj = String(cnpjOrgao || '').replace(/\D/g, '')
  const periodoQS = `dataInicial=${dataInicial}&dataFinal=${dataFinal}`

  const consultas = []
  if (unidade || cnpj) {
    for (const mod of modalidades) {
      consultas.push({
        uf: '', mod, maxPaginas: Math.max(maxPaginas, 5),
        urlDe: p => `${PNCP_BASE}/publicacao?${periodoQS}` +
          `&codigoModalidadeContratacao=${mod}` +
          (unidade ? `&codigoUnidadeAdministrativa=${unidade}` : '') +
          (cnpj ? `&cnpj=${cnpj}` : '') +
          `&tamanhoPagina=50&pagina=${p}`,
      })
    }
    return { consultas, periodo: { dataInicial, dataFinal } }
  }
  for (const mod of modalidades) {
    for (const uf of ufs) {
      consultas.push({ uf, mod, maxPaginas, urlDe: p =>
        `${PNCP_BASE}/publicacao?${periodoQS}` +
        `&codigoModalidadeContratacao=${mod}&uf=${uf}&tamanhoPagina=50&pagina=${p}` })
    }
  }
  return { consultas, periodo: { dataInicial, dataFinal } }
}

// Aplica o filtro de palavras-chave e remove duplicados
export function consolidar(brutos, termo) {
  const t = String(termo || '').toLowerCase().trim()
  const termos = t ? t.split(',').map(x => x.trim()).filter(Boolean) : []
  const vistos = new Set()
  const saida = []
  for (const { item, uf } of brutos) {
    const chave = item.numeroControlePNCP || JSON.stringify(item).slice(0, 60)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    const obj = String(item.objetoCompra || '').toLowerCase()
    if (termos.length && !termos.some(x => obj.includes(x))) continue
    saida.push(normalizar(item, uf))
  }
  saida.sort((a, b) => b.valorNum - a.valorNum)
  return saida
}
