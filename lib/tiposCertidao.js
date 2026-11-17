// Categorias e tipos de documento — espelham exatamente o sistema Apps Script
export const CATEGORIAS = [
  { slug: 'fiscal', nome: 'Regularidade Fiscal e Trabalhista', temValidade: true, tipos: [
    { slug: 'rfb_pgfn', nome: 'Receita Federal e PGFN' },
    { slug: 'fgts',     nome: 'Regularidade do FGTS' },
    { slug: 'tst',      nome: 'Tribunal Superior do Trabalho' },
    { slug: 'cert_conj_sefaz_pge', nome: 'Certidão Conjunta SEFAZ/PGE' },
    { slug: 'reg_mun',  nome: 'Regularidade Municipal' },
  ]},
  { slug: 'hab', nome: 'Habilitação Jurídica', temValidade: false, tipos: [
    { slug: 'cartao_cnpj',     nome: 'Cartão CNPJ' },
    { slug: 'contrato_social', nome: 'Contrato Social' },
    { slug: 'alvara_func',     nome: 'Alvará de Funcionamento' },
    { slug: 'cert_simpl',      nome: 'Certidão Simplificada' },
    { slug: 'insc_mun',        nome: 'Inscrição Municipal' },
    { slug: 'insc_est',        nome: 'Inscrição Estadual' },
  ]},
  { slug: 'tec', nome: 'Qualificação Técnica', temValidade: true, tipos: [
    { slug: 'alvara_san', nome: 'Alvará Sanitário' },
    { slug: 'anvisa',     nome: 'Autorização Anvisa' },
    { slug: 'eng',        nome: 'Prestação de Serviço do Engenheiro' },
    { slug: 'crea_pj',    nome: 'CREA — Pessoa Jurídica' },
    { slug: 'crea_pf',    nome: 'CREA — Pessoa Física' },
  ]},
  { slug: 'ecofin', nome: 'Qualificação Econômico-Financeira', temValidade: true, tipos: [
    { slug: 'bal_ult',  nome: 'Balanço Patrimonial (Último)' },
    { slug: 'bal_pen',  nome: 'Balanço Patrimonial (Penúltimo)' },
    { slug: 'falencia', nome: 'Certidão de Falência' },
  ]},
  { slug: 'atst', nome: 'Atestados', temValidade: true, tipos: [
    { slug: 'atst', nome: 'Atestado de Capacidade Técnica' },
  ]},
  { slug: 'pessoal', nome: 'Documentos Pessoais', temValidade: false, tipos: [
    { slug: 'rg_cnh_reg', nome: 'RG / CNH / Registro Profissional' },
    { slug: 'procuracao', nome: 'Procuração' },
    { slug: 'rg_cnh_rep', nome: 'RG / CNH (Representante)' },
  ]},
]

// A Certidão Conjunta SEFAZ/PGE substituiu dois tipos que existiam separados
// ("Regularidade Estadual" e "Certidão PGE"). Os documentos já cadastrados com
// os slugs antigos continuam na planilha, intactos; aqui eles são lidos como
// o tipo novo, sem precisar mexer em nenhuma linha.
export const SLUGS_LEGADOS = {
  reg_est: 'cert_conj_sefaz_pge',
  pge: 'cert_conj_sefaz_pge',
}

export function slugCanonico(slug) {
  const s = String(slug || '').trim()
  return SLUGS_LEGADOS[s] || s
}

function validadeComoNumero(v) {
  const br = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return Number(br[3] + br[2] + br[1])
  const iso = String(v || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  return iso ? Number(iso[1] + iso[2] + iso[3]) : 0
}

/**
 * Devolve os documentos já com o slug unificado. Quando a mesma empresa tem
 * mais de um documento dos tipos que foram unificados (ex.: uma Regularidade
 * Estadual e uma Certidão PGE), vale o de validade mais longa — o outro é só
 * histórico e não deve gerar alerta de vencimento. Tipos que aceitam vários
 * documentos (como atestados) não são mexidos.
 */
export function unificarDocumentos(documentos) {
  const alvos = new Set(Object.values(SLUGS_LEGADOS))
  const melhor = new Map()
  const saida = []
  for (const d of documentos) {
    const slugOriginal = String(d.tipo_slug || '').trim()
    const slug = slugCanonico(slugOriginal)
    const doc = slug === slugOriginal ? d : { ...d, tipo_slug: slug }
    if (!alvos.has(slug)) { saida.push(doc); continue }
    const chave = String(d.empresa_id || '').trim() + '|' + slug
    const atual = melhor.get(chave)
    if (!atual) { melhor.set(chave, doc); continue }
    const nova = validadeComoNumero(doc.validade)
    const velha = validadeComoNumero(atual.validade)
    const novaTemArquivo = !!(doc.drive_file_id || doc.drive_file_url)
    const velhaTemArquivo = !!(atual.drive_file_id || atual.drive_file_url)
    if (nova > velha || (nova === velha && novaTemArquivo && !velhaTemArquivo)) melhor.set(chave, doc)
  }
  return saida.concat([...melhor.values()])
}

const PORchaSLUG = {}
CATEGORIAS.forEach(c => c.tipos.forEach(t => { PORchaSLUG[t.slug] = { ...t, categoria: c } }))

export function rotuloTipo(slug) {
  const s = slugCanonico(slug)
  return PORchaSLUG[s]?.nome || s || 'Documento'
}

export function categoriaDoSlug(slug) {
  return PORchaSLUG[slugCanonico(slug)]?.categoria || null
}

export function temValidade(slug) {
  return !!categoriaDoSlug(slug)?.temValidade
}

// Mantido para compatibilidade com o dashboard
export const SLUGS_COM_VALIDADE = new Set(
  CATEGORIAS.filter(c => c.temValidade).flatMap(c => c.tipos.map(t => t.slug))
)
