// Só a página inicial fica aberta aos buscadores. O painel exige login (o
// Google nem chegaria lá), mas o link público de cotação NÃO exige — se um
// desses endereços vazar para alguma página indexada, os preços da proposta
// entrariam no Google. Por isso o bloqueio explícito.
export default function robots() {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/cotacao/', '/api/', '/login'],
    }],
  }
}
