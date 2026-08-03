// Links úteis para emissão/consulta de certidões e manuais de referência.
// Pré-cadastrados na primeira vez que a aba "Informacoes" é usada — o Adm
// pode completar, editar ou remover depois pela própria tela.
export const COLS_INFO = ['id', 'categoria', 'titulo', 'link', 'descricao', 'ordem', 'criadoEm']

export const LINKS_PADRAO = [
  { categoria: 'Regularidade Fiscal e Trabalhista', titulo: 'Certidão Conjunta Receita Federal / PGFN',
    link: 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-regularidade-fiscal',
    descricao: 'Débitos federais e Dívida Ativa da União. Emissão gratuita, validade 180 dias.' },
  { categoria: 'Regularidade Fiscal e Trabalhista', titulo: 'FGTS — Certificado de Regularidade (CRF)',
    link: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
    descricao: 'Site da Caixa. Peça CNPJ (ou CEI) e o estado da empresa. Validade 30 dias.' },
  { categoria: 'Regularidade Fiscal e Trabalhista', titulo: 'CNDT — Débitos Trabalhistas (TST)',
    link: 'https://www.tst.jus.br/certidao',
    descricao: 'Certidão Negativa de Débitos Trabalhistas, gratuita e imediata.' },
  { categoria: 'Regularidade Fiscal e Trabalhista', titulo: 'Regularidade Estadual — varia por UF',
    link: 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-regularidade-fiscal',
    descricao: 'Cada estado tem sua própria Secretaria da Fazenda (SEFAZ). Busque "certidão negativa SEFAZ [seu estado]".' },
  { categoria: 'Regularidade Fiscal e Trabalhista', titulo: 'Regularidade Municipal — varia por município',
    link: '', descricao: 'Emitida pela Prefeitura/Secretaria de Fazenda Municipal de cada cidade.' },
  { categoria: 'Habilitação Jurídica', titulo: 'Cartão CNPJ (Receita Federal)',
    link: 'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp',
    descricao: 'Comprovante de inscrição e situação cadastral, gratuito e imediato.' },
  { categoria: 'Qualificação Técnica', titulo: 'CREA — Certidão de Regularidade (PJ/PF)',
    link: 'https://www.confea.org.br/crea-do-brasil', descricao: 'Emitida pelo Crea do estado onde a empresa/profissional está registrado.' },
  { categoria: 'Qualificação Técnica', titulo: 'ANVISA — Consulta e Autorizações',
    link: 'https://www.gov.br/anvisa/pt-br', descricao: 'Autorização de funcionamento e consultas de regularidade sanitária.' },
  { categoria: 'Cadastro de Fornecedores', titulo: 'SICAF — Cadastro Unificado de Fornecedores',
    link: 'https://www.gov.br/compras/pt-br/sicaf', descricao: 'Cadastro usado pelo Comprasnet e outros órgãos federais.' },
  { categoria: 'Portais de Licitação', titulo: 'PNCP — Portal Nacional de Contratações Públicas',
    link: 'https://pncp.gov.br/app/editais', descricao: 'Editais, atas, contratos e catálogo de materiais/serviços.' },
]
