// Modelos comerciais por empresa e o cálculo de receita de cada empenho.
// É o que diferencia Raniellen (compra para revender → margem) de
// Montana (representação → comissão sobre o faturamento).

export const MODELOS = [
  { id: 'revenda',  nome: 'Revenda',       desc: 'Compro do fornecedor e revendo. A receita é a margem (venda − custo).' },
  { id: 'comissao', nome: 'Comissão',      desc: 'Represento o fabricante. A receita é um percentual do faturamento.' },
  { id: 'direto',   nome: 'Venda direta',  desc: 'Produção/venda própria. A receita é a margem sobre o custo informado.' },
]

export const ABA_CONFIG = 'Config_Empresas'
export const COLS_CONFIG = ['empresaId','modelo','percentualComissao','observacao','atualizadoEm']

export const ABA_EMPENHOS = 'Empenhos'
export const COLS_EMPENHOS = ['id','empresaId','empresaNome','ataId','numeroAta','orgao',
  'itemNumero','itemDescricao','numeroEmpenho','dataEmpenho','quantidade','valorUnitario',
  'custoUnitario','status','notaFiscal','dataFaturamento','dataPagamento','observacao','criadoEm']

export const STATUS_EMPENHO = ['Empenhado', 'Faturado', 'Entregue', 'Pago', 'Cancelado']

// Status que já representam dinheiro efetivamente recebido
export const STATUS_RECEBIDO = new Set(['Pago'])

const num = v => {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return isNaN(n) ? 0 : n
}

// Calcula os valores financeiros de um empenho conforme o modelo da empresa
export function calcularEmpenho(empenho, config) {
  const modelo = config?.modelo || 'revenda'
  const qtd = num(empenho.quantidade)
  const vUnit = num(empenho.valorUnitario)
  const cUnit = num(empenho.custoUnitario)

  const faturamento = qtd * vUnit   // valor da nota contra o órgão
  const custo = qtd * cUnit

  let receita          // o que efetivamente fica para o Adriano/cliente
  let base

  if (modelo === 'comissao') {
    const perc = num(config?.percentualComissao) || 0
    receita = faturamento * (perc / 100)
    base = perc + '% sobre o faturamento'
  } else {
    receita = faturamento - custo
    base = custo > 0 ? 'venda − custo' : 'sem custo informado'
  }

  const margemPerc = faturamento > 0 ? (receita / faturamento) * 100 : 0

  return {
    quantidade: qtd,
    valorUnitario: vUnit,
    custoUnitario: cUnit,
    faturamento,
    custo,
    receita,
    margemPerc,
    modelo,
    base,
  }
}

// Saldo de um item da ata: registrado − soma já empenhada
export function saldoDoItem(item, empenhosDaAta) {
  const registrado = num(item.quantidade)
  const chave = String(item.item || '').trim()
  const empenhado = empenhosDaAta
    .filter(e => String(e.itemNumero || '').trim() === chave && e.status !== 'Cancelado')
    .reduce((s, e) => s + num(e.quantidade), 0)
  return { registrado, empenhado, saldo: registrado - empenhado }
}

export const fmtBRL = n =>
  'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
