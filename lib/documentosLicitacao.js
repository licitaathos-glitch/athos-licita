// Geração da proposta (só com os itens vencidos) e das declarações exigidas
// no edital, a partir dos modelos que a IA leu do próprio edital (campo
// modelosDocsJson da licitação) e dos dados cadastrais da empresa.
//
// Roda no navegador: a tela importa este arquivo só quando o usuário pede os
// documentos, para a biblioteca docx não pesar no carregamento da lista.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header,
  AlignmentType, WidthType, BorderStyle, ShadingType, PageOrientation,
} from 'docx'

// ── Itens vencidos ─────────────────────────────────────────────
// Mesma regra da fase Disputa (ModalStatus) e do relatório mensal: colocação 1
// é nosso; outra colocação ou concorrente registrado é perdido; sem nada
// preenchido no item, vale o resultado geral da licitação.
export function resultadoItem(it, resultadoGeral) {
  const col = Number(it.colocacao) || null
  if (col === 1) return 'ganho'
  if (col || String(it.vencedorNome || '').trim()) return 'perdido'
  if (resultadoGeral === 'Ganhamos') return 'ganho'
  if (['Perdemos', 'Desclassificados', 'Deserta', 'Cancelada'].includes(resultadoGeral)) return 'perdido'
  return 'pendente'
}

export function precoFinal(it) {
  return Number(it.lanceFinal || it.meuValor) || 0
}

export function itensVencidos(itens, resultadoGeral) {
  return (itens || [])
    .map((it, indice) => ({ ...it, _indice: indice }))
    .filter(it => it.participar && resultadoItem(it, resultadoGeral) === 'ganho')
}

// ── Formatação ─────────────────────────────────────────────────
export const moeda = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const numeroBR = n => {
  const v = Number(n)
  if (!isFinite(v)) return String(n || '')
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export function dataExtenso(d = new Date()) {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

// Valor por extenso em reais — comum nos modelos de proposta
const UNID = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos']

function ate999(n) {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100), r = n % 100
  const partes = []
  if (c) partes.push(CEM[c])
  if (r) {
    if (r < 20) partes.push(UNID[r])
    else {
      const d = Math.floor(r / 10), u = r % 10
      partes.push(u ? `${DEZ[d]} e ${UNID[u]}` : DEZ[d])
    }
  }
  return partes.join(' e ')
}

function inteiroExtenso(n) {
  if (n === 0) return 'zero'
  const grupos = []
  let resto = n
  while (resto > 0) { grupos.push(resto % 1000); resto = Math.floor(resto / 1000) }
  const NOMES = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões'], ['trilhão', 'trilhões']]
  const partes = []
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i]
    if (!g) continue
    let txt = (i === 1 && g === 1) ? '' : ate999(g)
    if (i > 0) txt = (txt ? txt + ' ' : '') + NOMES[i][g === 1 ? 0 : 1]
    partes.push({ txt, g })
  }
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda
  return partes.map((p, i) => {
    if (i === 0) return p.txt
    const ultimo = i === partes.length - 1
    return (ultimo && (p.g < 100 || p.g % 100 === 0) ? ' e ' : ' ') + p.txt
  }).join('')
}

export function valorExtenso(valor) {
  const total = Math.round((Number(valor) || 0) * 100)
  const reais = Math.floor(total / 100), cent = total % 100
  const partes = []
  if (reais) {
    const txt = inteiroExtenso(reais)
    const de = /(milhão|milhões|bilhão|bilhões|trilhão|trilhões)$/.test(txt) ? ' de' : ''
    partes.push(txt + de + (reais === 1 ? ' real' : ' reais'))
  }
  if (cent) partes.push(inteiroExtenso(cent) + (cent === 1 ? ' centavo' : ' centavos'))
  return partes.length ? partes.join(' e ') : 'zero real'
}

// ── Campos substituíveis ───────────────────────────────────────
// A IA escreve os textos com {{CHAVE}} onde entra dado da empresa (ou da
// nossa proposta) e com [[descrição]] onde há lacuna que nem o edital nem o
// cadastro resolvem. Tudo o que faltar sai destacado em amarelo no Word —
// nunca em branco, para nada seguir incompleto sem ninguém perceber.
export const ROTULOS = {
  RAZAO_SOCIAL: 'razão social', NOME_FANTASIA: 'nome fantasia', CNPJ: 'CNPJ',
  INSCRICAO_ESTADUAL: 'inscrição estadual', INSCRICAO_MUNICIPAL: 'inscrição municipal',
  ENDERECO_COMPLETO: 'endereço', CIDADE: 'cidade', UF: 'UF', CEP: 'CEP',
  EMAIL: 'e-mail', TELEFONE: 'telefone',
  REP_NOME: 'nome do representante legal', REP_CPF: 'CPF do representante',
  REP_RG: 'RG do representante', REP_CARGO: 'cargo do representante',
  REP_NACIONALIDADE: 'nacionalidade do representante', REP_ESTADO_CIVIL: 'estado civil do representante',
  BANCO: 'banco', AGENCIA: 'agência', CONTA: 'conta',
  ORGAO: 'órgão', UASG: 'UASG', NUMERO_EDITAL: 'nº do edital', MODALIDADE: 'modalidade',
  OBJETO: 'objeto', DATA_EXTENSO: 'data', LOCAL_DATA: 'local e data',
  VALOR_GLOBAL: 'valor global', VALOR_GLOBAL_EXTENSO: 'valor global por extenso',
}

export function montarValores({ empresa = {}, lic = {}, totalGlobal = 0, data = new Date() }) {
  const e = empresa
  const s = v => String(v ?? '').trim()
  const cidadeUF = [s(e.cidade), s(e.uf)].filter(Boolean).join('/')
  const endereco = [
    [s(e.endereco), s(e.numero)].filter(Boolean).join(', '),
    s(e.bairro),
    cidadeUF,
    s(e.cep) ? 'CEP ' + s(e.cep) : '',
  ].filter(Boolean).join(' – ')
  return {
    RAZAO_SOCIAL: s(e.razao_social) || s(e.nome),
    NOME_FANTASIA: s(e.nome_fantasia),
    CNPJ: s(e.cnpj),
    INSCRICAO_ESTADUAL: s(e.inscricao_estadual),
    INSCRICAO_MUNICIPAL: s(e.inscricao_municipal),
    ENDERECO_COMPLETO: s(e.endereco) ? endereco : '',
    CIDADE: s(e.cidade), UF: s(e.uf), CEP: s(e.cep),
    EMAIL: s(e.email), TELEFONE: s(e.telefone),
    REP_NOME: s(e.rep_nome) || s(e.responsavel),
    REP_CPF: s(e.rep_cpf), REP_RG: s(e.rep_rg), REP_CARGO: s(e.rep_cargo),
    REP_NACIONALIDADE: s(e.rep_nacionalidade), REP_ESTADO_CIVIL: s(e.rep_estado_civil),
    BANCO: s(e.banco), AGENCIA: s(e.agencia), CONTA: s(e.conta),
    ORGAO: s(lic.orgao), UASG: s(lic.uasg), NUMERO_EDITAL: s(lic.numeroEdital),
    MODALIDADE: s(lic.modalidade), OBJETO: s(lic.objeto),
    DATA_EXTENSO: dataExtenso(data),
    LOCAL_DATA: (s(e.cidade) ? cidadeUF + ', ' : '') + dataExtenso(data),
    VALOR_GLOBAL: moeda(totalGlobal),
    VALOR_GLOBAL_EXTENSO: valorExtenso(totalGlobal),
  }
}

// Quebra um texto em pedaços: texto comum, valor preenchido ou lacuna
export function pedacos(texto, valores) {
  const out = []
  const re = /\{\{\s*([A-Z_]+)\s*\}\}|\[\[([^\]]*)\]\]/g
  let ultimo = 0, m
  const str = String(texto || '')
  while ((m = re.exec(str))) {
    if (m.index > ultimo) out.push({ tipo: 'texto', txt: str.slice(ultimo, m.index) })
    if (m[1]) {
      const chave = m[1]
      const v = valores[chave]
      if (v) out.push({ tipo: 'valor', txt: v })
      else out.push({ tipo: 'lacuna', txt: `[preencher: ${ROTULOS[chave] || chave.toLowerCase()}]`, chave })
    } else {
      out.push({ tipo: 'lacuna', txt: `[preencher: ${m[2].trim() || '...'}]` })
    }
    ultimo = re.lastIndex
  }
  if (ultimo < str.length) out.push({ tipo: 'texto', txt: str.slice(ultimo) })
  return out
}

// Campos do cadastro que estão vazios e que os documentos vão usar — a tela
// mostra a lista antes de gerar, para dar tempo de completar o cadastro
export function camposFaltando(modelos, valores, declaracoesEscolhidas) {
  const textos = []
  const p = modelos?.proposta || {}
  textos.push(p.destinatario, p.introducao, p.encerramento, ...(p.clausulas || []))
  ;(modelos?.declaracoes || []).forEach((d, i) => {
    if (!declaracoesEscolhidas || declaracoesEscolhidas.includes(i)) textos.push(d.texto)
  })
  // Cabeçalho, bloco de dados e assinatura usam sempre estes
  textos.push('{{RAZAO_SOCIAL}} {{CNPJ}} {{ENDERECO_COMPLETO}} {{REP_NOME}} {{REP_CPF}} {{REP_CARGO}}')
  const faltam = new Set()
  textos.forEach(t => pedacos(t, valores).forEach(x => { if (x.chave) faltam.add(x.chave) }))
  return [...faltam].map(c => ROTULOS[c] || c)
}

// ── Montagem do Word ───────────────────────────────────────────
const FONTE = 'Arial'
const BORDA = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA }

function runs(texto, valores, extra = {}) {
  return pedacos(texto, valores).map(p => new TextRun({
    text: p.txt, font: FONTE, ...extra,
    ...(p.tipo === 'lacuna' ? { highlight: 'yellow', bold: true } : {}),
  }))
}

// Um parágrafo do Word por linha do texto (o docx não aceita \n dentro do run)
function paragrafos(texto, valores, opcoes = {}) {
  return String(texto || '').split(/\n+/).map(l => l.trim()).filter(Boolean).map(linha =>
    new Paragraph({
      alignment: opcoes.alinhamento || AlignmentType.JUSTIFIED,
      spacing: { after: 160, line: 300 },
      children: runs(linha, valores, opcoes.run || {}),
    }))
}

function titulo(texto) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 120, after: 280 },
    children: [new TextRun({ text: String(texto || '').toUpperCase(), bold: true, size: 26, font: FONTE })],
  })
}

function cabecalhoEmpresa(valores) {
  const linha2 = [valores.CNPJ && 'CNPJ ' + valores.CNPJ, valores.ENDERECO_COMPLETO].filter(Boolean).join(' – ')
  const linha3 = [valores.TELEFONE, valores.EMAIL].filter(Boolean).join(' – ')
  return new Header({
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: valores.RAZAO_SOCIAL || '', bold: true, size: 22, font: FONTE })] }),
      ...[linha2, linha3].filter(Boolean).map(t => new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: t, size: 16, color: '555555', font: FONTE })] })),
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1B2E4B', space: 4 } }, children: [] }),
    ],
  })
}

function assinatura(valores) {
  return [
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 360, after: 720 },
      children: runs('{{LOCAL_DATA}}.', valores) }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '_______________________________________________', font: FONTE })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: runs('{{REP_NOME}}', valores, { bold: true }) }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: runs('{{REP_CARGO}} – CPF {{REP_CPF}}', valores, { size: 20 }) }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: runs('{{RAZAO_SOCIAL}} – CNPJ {{CNPJ}}', valores, { size: 20 }) }),
  ]
}

function celula(conteudo, largura, { cabecalho = false, alinhamento = AlignmentType.LEFT, lacuna = false } = {}) {
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    borders: BORDAS,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    shading: cabecalho ? { fill: 'E8EEF6', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({ alignment: alinhamento, children: [new TextRun({
      text: String(conteudo ?? ''), font: FONTE, size: 18, bold: cabecalho || lacuna,
      ...(lacuna ? { highlight: 'yellow' } : {}),
    })] })],
  })
}

// Largura relativa de cada tipo de coluna da tabela de itens
const PESO_COLUNA = { numero: 6, descricao: 34, unidade: 8, quantidade: 9, marca: 11, modelo: 11,
  fabricante: 11, valorUnitario: 13, valorTotal: 14, outro: 11 }

export const COLUNAS_PADRAO = [
  { titulo: 'Item', campo: 'numero' }, { titulo: 'Descrição', campo: 'descricao' },
  { titulo: 'Unid.', campo: 'unidade' }, { titulo: 'Qtd.', campo: 'quantidade' },
  { titulo: 'Valor unitário', campo: 'valorUnitario' }, { titulo: 'Valor total', campo: 'valorTotal' },
]

function valorColuna(it, campo) {
  switch (campo) {
    case 'numero': return { v: it.numero ?? '' }
    case 'descricao': return { v: it.descricao || '' }
    case 'unidade': return { v: it.unidade || 'UN' }
    case 'quantidade': return { v: numeroBR(it.quantidade) }
    case 'valorUnitario': return { v: moeda(precoFinal(it)) }
    case 'valorTotal': return { v: moeda(precoFinal(it) * (Number(it.quantidade) || 0)) }
    case 'marca': case 'modelo': case 'fabricante': {
      const v = String(it[campo] || '').trim()
      return v ? { v } : { v: '[preencher]', lacuna: true }
    }
    default: return { v: '[preencher]', lacuna: true }
  }
}

function tabelaItens(itens, colunas, larguraTotal) {
  const pesos = colunas.map(c => PESO_COLUNA[c.campo] || PESO_COLUNA.outro)
  const soma = pesos.reduce((a, b) => a + b, 0)
  const larguras = pesos.map(p => Math.floor(larguraTotal * p / soma))
  larguras[larguras.length - 1] += larguraTotal - larguras.reduce((a, b) => a + b, 0)
  const alinhar = c => ['valorUnitario', 'valorTotal'].includes(c) ? AlignmentType.RIGHT
    : ['numero', 'unidade', 'quantidade'].includes(c) ? AlignmentType.CENTER : AlignmentType.LEFT

  return new Table({
    width: { size: larguraTotal, type: WidthType.DXA },
    columnWidths: larguras,
    rows: [
      new TableRow({ tableHeader: true, children: colunas.map((c, i) =>
        celula(c.titulo, larguras[i], { cabecalho: true, alinhamento: AlignmentType.CENTER })) }),
      ...itens.map(it => new TableRow({ children: colunas.map((c, i) => {
        const { v, lacuna } = valorColuna(it, c.campo)
        return celula(v, larguras[i], { alinhamento: alinhar(c.campo), lacuna })
      }) })),
    ],
  })
}

function tabelaDadosEmpresa(valores, largura) {
  const linhas = [
    ['Razão social', '{{RAZAO_SOCIAL}}'], ['CNPJ', '{{CNPJ}}'],
    ['Inscrição estadual / municipal', [valores.INSCRICAO_ESTADUAL, valores.INSCRICAO_MUNICIPAL].filter(Boolean).join(' / ') || '[[inscrição estadual/municipal]]'],
    ['Endereço', '{{ENDERECO_COMPLETO}}'], ['Telefone', '{{TELEFONE}}'], ['E-mail', '{{EMAIL}}'],
    ['Banco / agência / conta', [valores.BANCO, valores.AGENCIA && 'Ag. ' + valores.AGENCIA, valores.CONTA && 'C/C ' + valores.CONTA].filter(Boolean).join(' – ') || '[[dados bancários]]'],
    ['Representante legal', '{{REP_NOME}} – CPF {{REP_CPF}} – RG {{REP_RG}} – {{REP_CARGO}}'],
  ]
  const l1 = Math.round(largura * 0.3), l2 = largura - l1
  return new Table({
    width: { size: largura, type: WidthType.DXA }, columnWidths: [l1, l2],
    rows: linhas.map(([rot, txt]) => new TableRow({ children: [
      celula(rot, l1, { cabecalho: true }),
      new TableCell({ width: { size: l2, type: WidthType.DXA }, borders: BORDAS,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({ children: runs(txt, valores, { size: 18 }) })] }),
    ] })),
  })
}

const A4 = { width: 11906, height: 16838 }
const MARGEM = 1134 // 2 cm

function documento(valores, secoes) {
  return new Document({
    creator: 'Athos Licita',
    styles: { default: { document: { run: { font: FONTE, size: 22 } } } },
    sections: secoes.map(s => ({
      properties: { page: {
        size: s.paisagem ? { ...A4, orientation: PageOrientation.LANDSCAPE } : A4,
        margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
      } },
      headers: { default: cabecalhoEmpresa(valores) },
      children: s.children,
    })),
  })
}

export function gerarDocProposta({ modelos, itens, empresa, lic }) {
  const p = modelos?.proposta || {}
  const colunas = (Array.isArray(p.colunas) && p.colunas.length ? p.colunas : COLUNAS_PADRAO)
    .map(c => ({ titulo: String(c.titulo || '').trim() || c.campo, campo: c.campo || 'outro' }))
  const total = itens.reduce((s, it) => s + precoFinal(it) * (Number(it.quantidade) || 0), 0)
  const valores = montarValores({ empresa, lic, totalGlobal: total })
  const paisagem = colunas.length >= 7
  const largura = (paisagem ? A4.height : A4.width) - 2 * MARGEM

  const children = [
    titulo(p.titulo || 'Proposta de preços'),
    ...paragrafos(p.destinatario, valores, { alinhamento: AlignmentType.LEFT }),
    ...paragrafos(p.introducao, valores),
    new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: 'DADOS DA EMPRESA', bold: true, font: FONTE })] }),
    tabelaDadosEmpresa(valores, largura),
    new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: 'ITENS COTADOS', bold: true, font: FONTE })] }),
    tabelaItens(itens, colunas, largura),
    new Paragraph({ spacing: { before: 200, after: 200 }, children: runs(
      'VALOR GLOBAL DA PROPOSTA: {{VALOR_GLOBAL}} ({{VALOR_GLOBAL_EXTENSO}}).', valores, { bold: true }) }),
    ...(p.clausulas || []).flatMap(c => paragrafos(c, valores)),
    ...paragrafos(p.encerramento, valores),
    ...assinatura(valores),
  ]
  return documento(valores, [{ paisagem, children }])
}

export function gerarDocDeclaracoes({ modelos, indices, empresa, lic }) {
  const valores = montarValores({ empresa, lic })
  const lista = (modelos?.declaracoes || []).filter((_, i) => !indices || indices.includes(i))
  // Uma seção por declaração = uma por página, cada uma com cabeçalho e assinatura
  return documento(valores, lista.map(d => ({
    children: [
      titulo(d.titulo || 'Declaração'),
      ...paragrafos(d.texto, valores),
      ...assinatura(valores),
    ],
  })))
}

export async function baixarDocx(doc, nomeArquivo) {
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nomeArquivo
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function nomeSeguro(txt) {
  return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60)
}
