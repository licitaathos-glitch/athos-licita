// Checklist de viabilidade — estruturado por etapa de decisão.
// "eliminatorio: true" significa que uma resposta NÃO deve levar ao descarte.

export const CHECKLIST = [
  {
    secao: 'Enquadramento',
    desc: 'Podemos disputar esta licitação?',
    itens: [
      { k: 'meepp', label: 'Cota exclusiva ME/EPP', eliminatorio: true,
        pergunta: 'Nos enquadramos na condição exigida (ME/EPP, cota reservada ou ampla concorrência)?',
        ajuda: 'Responda NÃO se o edital reserva o item a ME/EPP e a empresa não se enquadra — ou o contrário.' },
      { k: 'objeto', label: 'Aderência do objeto', eliminatorio: true,
        pergunta: 'O que está sendo licitado é efetivamente o que vendemos?',
        ajuda: 'Objeto genérico com anexo específico é armadilha comum. Confira o Termo de Referência, não o título.' },
      { k: 'especTecnica', label: 'Especificação técnica', eliminatorio: true,
        pergunta: 'Nosso produto atende 100% das exigências do Termo de Referência?',
        ajuda: 'Marca de referência, norma ABNT, dimensões, certificações. Atender 95% reprova na análise.' },
      { k: 'amostra', label: 'Amostra / prova de conceito',
        pergunta: 'Se houver exigência de amostra ou laudo, conseguimos entregar no prazo?',
        ajuda: 'Prazos de amostra costumam ser de 2 a 5 dias úteis após a fase de lances.' },
    ],
  },
  {
    secao: 'Habilitação',
    desc: 'Temos os documentos para vencer a fase de habilitação?',
    itens: [
      { k: 'certidoes', label: 'Certidões e regularidade', eliminatorio: true,
        pergunta: 'Todas as certidões exigidas estarão válidas na data da sessão?',
        ajuda: 'O sistema confere automaticamente as certidões cadastradas — veja o alerta abaixo.' },
      { k: 'qualTecnica', label: 'Qualificação técnica', eliminatorio: true,
        pergunta: 'Temos os atestados de capacidade técnica nas quantidades e no prazo exigidos?',
        ajuda: 'Atenção ao percentual mínimo do quantitativo licitado e à exigência de registro no CREA/CRQ.' },
      { k: 'qualEconFin', label: 'Qualificação econômico-financeira', eliminatorio: true,
        pergunta: 'Atendemos aos índices contábeis e ao capital ou patrimônio mínimo?',
        ajuda: 'Liquidez corrente, geral e solvência costumam exigir ≥ 1,0. Confira o balanço do último exercício.' },
      { k: 'declaracoes', label: 'Declarações e anexos',
        pergunta: 'Todos os modelos de declaração do edital foram preenchidos e assinados?',
        ajuda: 'Declaração de menor, de inexistência de fato impeditivo, de elaboração independente de proposta.' },
    ],
  },
  {
    secao: 'Operação',
    desc: 'Conseguimos executar sem prejuízo?',
    itens: [
      { k: 'prazoEntrega', label: 'Prazo de entrega',
        pergunta: 'O prazo de entrega ou execução é viável para a nossa operação?',
        ajuda: 'Considere o lead time do fornecedor, não só o seu estoque.' },
      { k: 'frete', label: 'Local de entrega e frete',
        pergunta: 'O custo de frete até o local de entrega está embutido no preço?',
        ajuda: 'Entregas em múltiplas unidades ou no interior costumam inviabilizar a margem.' },
      { k: 'garantia', label: 'Garantia contratual',
        pergunta: 'Se exigir garantia, temos como prestá-la?',
        ajuda: 'Normalmente 1% a 5% do valor do contrato, em caução, seguro ou fiança.' },
      { k: 'penalidades', label: 'Penalidades e obrigações',
        pergunta: 'As multas e obrigações acessórias são aceitáveis?',
        ajuda: 'Multa diária por atraso acima de 0,5% ao dia merece atenção.' },
    ],
  },
  {
    secao: 'Financeiro',
    desc: 'O negócio se paga?',
    itens: [
      { k: 'preco', label: 'Preço de referência', eliminatorio: true,
        pergunta: 'O valor estimado permite disputa com margem positiva?',
        ajuda: 'Compare o preço de referência com o seu custo. Estimativa muito abaixo do mercado é sinal de descarte.' },
      { k: 'pagamento', label: 'Prazo de pagamento',
        pergunta: 'O prazo de pagamento cabe no nosso fluxo de caixa?',
        ajuda: 'Considere o prazo legal (até 30 dias da liquidação) mais o histórico real do órgão.' },
      { k: 'orgao', label: 'Histórico do órgão',
        pergunta: 'O órgão tem bom histórico de pagamento e de execução?',
        ajuda: 'Se já temos ata ou contrato com este órgão, consulte o módulo Financeiro.' },
    ],
  },
]

export const TODOS_ITENS = CHECKLIST.flatMap(s => s.itens)

// Gera a recomendação a partir das respostas
export function avaliar(respostas) {
  const dados = respostas || {}
  const eliminatorios = TODOS_ITENS.filter(i => i.eliminatorio)
  const reprovados = eliminatorios.filter(i => dados[i.k]?.resposta === 'N')
  const respondidos = TODOS_ITENS.filter(i => dados[i.k]?.resposta).length
  const total = TODOS_ITENS.length

  if (reprovados.length) {
    return {
      veredito: 'descartar',
      titulo: 'Recomendação: descartar',
      motivo: 'Reprovado em critério eliminatório: ' + reprovados.map(i => i.label).join(', ') + '.',
      reprovados: reprovados.map(i => i.k),
      respondidos, total,
    }
  }
  if (respondidos < total) {
    return {
      veredito: 'incompleto',
      titulo: 'Análise incompleta',
      motivo: `Faltam ${total - respondidos} de ${total} itens para concluir a análise.`,
      reprovados: [], respondidos, total,
    }
  }
  const atencao = TODOS_ITENS.filter(i => dados[i.k]?.resposta === 'N')
  if (atencao.length) {
    return {
      veredito: 'atencao',
      titulo: 'Recomendação: participar com ressalvas',
      motivo: 'Pontos de atenção não eliminatórios: ' + atencao.map(i => i.label).join(', ') + '.',
      reprovados: [], respondidos, total,
    }
  }
  return {
    veredito: 'participar',
    titulo: 'Recomendação: participar',
    motivo: 'Todos os critérios foram atendidos.',
    reprovados: [], respondidos, total,
  }
}
