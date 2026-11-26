// Preço de um item em R$, em um lugar só.
//
// Na Inscrição de proposta o "Valor mínimo" (meuValor) pode ser digitado de
// duas formas: preço em R$ ou "% de desconto" sobre o valor estimado. Quem for
// somar, mostrar ou gerar documento com esse valor precisa convertê-lo antes —
// senão um desconto de 10% vira "R$ 10,00". Use sempre estas funções.

const n = v => Number(v) || 0

// Valor mínimo da proposta já em R$ (converte o % de desconto quando for o caso).
export function precoProposta(it) {
  const v = n(it?.meuValor)
  if (it?.formaValor === 'desconto') return n(it.valorUnitarioRef) * (1 - v / 100)
  return v
}

// Preço com que disputamos o item: o lance final digitado na Disputa (sempre
// em R$) ou, se ainda não houver, o valor mínimo da proposta convertido.
export function precoLance(it) {
  return n(it?.lanceFinal) || precoProposta(it)
}
