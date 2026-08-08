// Itens do resumo do edital, organizados por assunto. Não é mais um
// checklist interativo (Sim/Não) — a resposta de cada item é preenchida
// pela IA ao ler o edital, e o "label" é só o rótulo usado no resumo em
// texto. "certidoes" aqui é a lista de certidões/documentos que O EDITAL
// exige (informativo) — não confundir com o alerta automático de validade
// das certidões da própria empresa, que é uma checagem separada e à parte.
export const CHECKLIST = [
  {
    secao: 'Habilitação',
    itens: [
      { k: 'certidoes', label: 'Certidões e documentos de habilitação exigidos' },
      { k: 'qualTecnica', label: 'Qualificação técnica' },
      { k: 'qualEconFin', label: 'Qualificação econômico-financeira' },
      { k: 'declaracoes', label: 'Declarações exigidas' },
    ],
  },
  {
    secao: 'Operação',
    itens: [
      { k: 'prazoEntrega', label: 'Prazo de entrega' },
      { k: 'frete', label: 'Local de entrega e frete' },
      { k: 'amostra', label: 'Amostra / prova de conceito' },
      { k: 'vistoria', label: 'Vistoria técnica' },
      { k: 'garantia', label: 'Garantia contratual' },
    ],
  },
  {
    secao: 'Financeiro',
    itens: [
      { k: 'pagamento', label: 'Prazo de pagamento' },
    ],
  },
]

export const TODOS_ITENS = CHECKLIST.flatMap(s => s.itens)

// Monta o resumo em texto corrido a partir das respostas preenchidas pela
// IA — usado na tela de Em análise, no resumo completo (PDF) e no e-mail
// pra empresa/fornecedor. Recebe o objeto de respostas (chkDados).
export function gerarResumoTexto(chkDados) {
  const dados = chkDados || {}
  const linha = k => {
    const it = TODOS_ITENS.find(i => i.k === k)
    const d = dados[k]
    if (!it || !d?.resposta) return null
    const resp = d.resposta === 'S' ? 'Sim' : d.resposta === 'N' ? 'Não' : 'N/A'
    return `${it.label}: ${resp}${d.detalhe ? ' — ' + d.detalhe : ''}`
  }
  // Ordem pensada pra quem vai ler e decidir: técnica, financeira, prazos,
  // amostra/vistoria, depois documentos e o resto.
  const ordem = ['qualTecnica', 'qualEconFin', 'prazoEntrega', 'pagamento', 'amostra', 'vistoria',
    'certidoes', 'declaracoes', 'frete', 'garantia']
  return ordem.map(linha).filter(Boolean).join('\n')
}
