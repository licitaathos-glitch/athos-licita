// Categorias e tipos de documento — espelham exatamente o sistema Apps Script
export const CATEGORIAS = [
  { slug: 'fiscal', nome: 'Regularidade Fiscal e Trabalhista', temValidade: true, tipos: [
    { slug: 'rfb_pgfn', nome: 'Receita Federal e PGFN' },
    { slug: 'fgts',     nome: 'Regularidade do FGTS' },
    { slug: 'tst',      nome: 'Tribunal Superior do Trabalho' },
    { slug: 'reg_est',  nome: 'Regularidade Estadual' },
    { slug: 'reg_mun',  nome: 'Regularidade Municipal' },
    { slug: 'pge',      nome: 'Certidão PGE' },
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

const PORchaSLUG = {}
CATEGORIAS.forEach(c => c.tipos.forEach(t => { PORchaSLUG[t.slug] = { ...t, categoria: c } }))

export function rotuloTipo(slug) {
  const s = String(slug || '').trim()
  return PORchaSLUG[s]?.nome || s || 'Documento'
}

export function categoriaDoSlug(slug) {
  return PORchaSLUG[String(slug || '').trim()]?.categoria || null
}

export function temValidade(slug) {
  return !!categoriaDoSlug(slug)?.temValidade
}

// Mantido para compatibilidade com o dashboard
export const SLUGS_COM_VALIDADE = new Set(
  CATEGORIAS.filter(c => c.temValidade).flatMap(c => c.tipos.map(t => t.slug))
)
