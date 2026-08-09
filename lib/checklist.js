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
      { k: 'enderecoExecucao', label: 'Endereço de execução do serviço' },
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

// Ordem pensada pra quem vai ler e decidir: técnica, financeira, prazos e
// local, amostra/vistoria, depois documentos e o resto.
const ORDEM_RESUMO = ['qualTecnica', 'qualEconFin', 'prazoEntrega', 'enderecoExecucao', 'pagamento',
  'amostra', 'vistoria', 'certidoes', 'declaracoes', 'frete', 'garantia']

// Monta o resumo como lista estruturada {label, resposta, detalhe} — cada
// consumidor (PDF, e-mail) decide como formatar (rótulo em negrito/caixa
// alta, resposta na linha de baixo, etc.). Recebe o objeto de respostas
// preenchido pela IA (chkDados).
export function gerarResumoItens(chkDados) {
  const dados = chkDados || {}
  return ORDEM_RESUMO.map(k => {
    const it = TODOS_ITENS.find(i => i.k === k)
    const d = dados[k]
    if (!it || !d?.resposta) return null
    const resposta = d.resposta === 'S' ? 'Sim' : d.resposta === 'N' ? 'Não' : 'N/A'
    return { label: it.label, resposta, detalhe: d.detalhe || '' }
  }).filter(Boolean)
}

// Versão em texto corrido (uma linha por item) — usada onde não há
// formatação rica disponível, como no e-mail de pedido de cotação.
export function gerarResumoTexto(chkDados) {
  return gerarResumoItens(chkDados)
    .map(it => `${it.label}: ${it.resposta}${it.detalhe ? ' — ' + it.detalhe : ''}`)
    .join('\n')
}
