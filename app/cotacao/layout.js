// A página de cotação é pública por design (o fornecedor não cria conta), mas
// não deve aparecer em buscador nenhum: ela mostra itens e preços da proposta.
// O robots.txt já bloqueia o rastreamento; o noindex garante que, se o
// endereço chegar ao Google por outro caminho, ele não publique a página.
export const metadata = {
  title: 'Pedido de cotação — Athos Licita',
  robots: { index: false, follow: false, nocache: true },
}

export default function CotacaoLayout({ children }) {
  return children
}
