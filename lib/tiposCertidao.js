// Rótulos legíveis para os slugs de documentos usados no sistema Apps Script
export const TIPOS_CERTIDAO = {
  rfb_pgfn:   'Receita Federal / PGFN',
  fgts:       'FGTS (CRF)',
  tst:        'Trabalhista (CNDT/TST)',
  reg_est:    'Regularidade Estadual',
  reg_mun:    'Regularidade Municipal',
  pge:        'PGE',
  alvara_san: 'Alvará Sanitário',
  anvisa:     'ANVISA',
  eng:        'Engenheiro responsável',
  crea_pj:    'CREA — Pessoa Jurídica',
  crea_pf:    'CREA — Pessoa Física',
  bal_ult:    'Balanço — último exercício',
  bal_pen:    'Balanço — penúltimo exercício',
  falencia:   'Certidão de Falência',
  atst:       'Atestado de Capacidade Técnica',
}

// Slugs que possuem data de validade (os demais são documentos permanentes)
export const SLUGS_COM_VALIDADE = new Set([
  'rfb_pgfn', 'fgts', 'tst', 'reg_est', 'reg_mun', 'pge',
  'alvara_san', 'anvisa', 'eng', 'crea_pj', 'crea_pf',
  'bal_ult', 'bal_pen', 'falencia', 'atst',
])

export function rotuloTipo(slug) {
  const s = String(slug || '').trim()
  return TIPOS_CERTIDAO[s] || s || 'Documento'
}
