// Importação em lote a partir da exportação "Minhas Licitações" do Licitei.
// Formato esperado da planilha (aba "Dados"):
// Portal | Título | Órgão | UF | Fase | Tags | Observações | Data de Abertura | Valor

const fmtDataParaISO = v => {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

function extrairNumeroEdital(titulo) {
  // Remove uma anotação entre parênteses no início ("(Lote 27) PE 24/2026 - ...")
  const semParenteses = String(titulo || '').replace(/^\([^)]*\)\s*/, '')
  return semParenteses.split(' - ')[0].trim()
}

function normalizarValor(v) {
  const limpo = String(v || '').replace(/\u00a0/g, ' ').trim()
  return limpo && limpo !== 'R$ 0,00' ? limpo : ''
}

// Palavras que indicam, no texto livre da observação, o que de fato aconteceu —
// usadas como reforço/checagem das tags, já que a planilha às vezes tem a tag
// desatualizada em relação à observação escrita à mão.
const SINAIS_TEXTO = [
  { termo: /n[ãa]o participa|n[ãa]o atende|n[ãa]o vencemos|n[ãa]o participar/i, sinal: 'nao_participou' },
  { termo: /vencemos|somos vencedor|ganhamos/i, sinal: 'venceu' },
  { termo: /perdemos|inabilita/i, sinal: 'perdeu' },
  { termo: /aguardando precifica/i, sinal: 'precificando' },
]

function sinaisDoTexto(obs) {
  const achados = new Set()
  SINAIS_TEXTO.forEach(({ termo, sinal }) => { if (termo.test(obs || '')) achados.add(sinal) })
  return achados
}

// Decide fase/status/resultado/participar a partir das tags do Licitei —
// é uma heurística, por isso cada linha carrega um "confianca" e um "aviso"
// para o Adm revisar antes de confirmar a importação.
export function mapearLinha({ portal, titulo, orgao, uf, fase, tags, observacoes, dataAbertura, valor }) {
  const listaTags = String(tags || '').split(',').map(t => t.trim().toUpperCase())
  const temTag = t => listaTags.some(x => x.includes(t))
  const texto = sinaisDoTexto(observacoes)

  let novaFase = 'Em analise'
  let status = 'Aberta'
  let resultado = 'Aguardando'
  let participar = 'Pendente'
  let motivo = ''
  let aviso = ''

  const naoParticipouPorTag = temTag('NÃO PARTICIPAÇÃO') || temTag('NAO PARTICIPACAO')
  const naoParticipouPorTexto = texto.has('nao_participou')

  if (naoParticipouPorTag || naoParticipouPorTexto) {
    novaFase = 'Descartado'; status = 'Encerrada'; participar = 'Não'; resultado = 'Nao participamos'
    motivo = observacoes || ''
    if (naoParticipouPorTexto && !naoParticipouPorTag) aviso = 'Só a observação indica não participação — a tag não confirma.'
  } else if (temTag('PERDIDA') || texto.has('perdeu')) {
    novaFase = 'Finalizada'; status = 'Encerrada'; participar = 'Sim'; resultado = 'Perdemos'
  } else if (temTag('VENCEDOR') || texto.has('venceu')) {
    novaFase = 'Finalizada'; status = 'Encerrada'; participar = 'Sim'; resultado = 'Ganhamos'
  } else if (temTag('SUSPENSO')) {
    status = 'Suspensa'; participar = 'Sim'
    novaFase = fase === 'Análise' ? 'Em analise' : 'Disputa'
  } else if (temTag('AGUARDANDO PRECIFICAÇÃO') || texto.has('precificando')) {
    novaFase = 'Inscricao'; participar = 'Sim'
  } else {
    // Sem tag de desfecho — marcada como concluída pelo Licitei (Homologada),
    // mas não sabemos se participamos. Fica para revisão manual.
    novaFase = fase === 'Análise' ? 'Em analise' : fase === 'Fase de Lance' ? 'Disputa' : 'Finalizada'
    aviso = 'Sem tag de resultado (participação/perda/vitória) — confira antes de importar.'
  }

  const iso = fmtDataParaISO(dataAbertura)
  return {
    numeroEdital: extrairNumeroEdital(titulo),
    objeto: titulo || '', // a planilha do Licitei não traz descrição do objeto, só o título
    orgao: orgao || '', uf: uf || '', portal: portal || '',
    valor: normalizarValor(valor),
    dataAbertura: dataAbertura || '', dataSessao: dataAbertura || '',
    dataAberturaISO: iso,
    fase: novaFase, status, resultado, participar, motivo,
    origem: 'importacao_licitei',
    _aviso: aviso,
    _tagsOriginais: tags || '', _observacoesOriginais: observacoes || '', _faseOriginalLicitei: fase || '',
  }
}

// Lê o workbook (via SheetJS, já parseado) e filtra por mês/ano e por uma
// palavra-chave que identifique a empresa nas tags (ex: "MONTANA")
export function filtrarELinhas(linhasPlanilha, { mes, ano, palavraEmpresa }) {
  const chave = String(palavraEmpresa || '').trim().toUpperCase()
  return linhasPlanilha
    .filter(l => {
      const tags = String(l['Tags'] || '').toUpperCase()
      if (chave && !tags.includes(chave)) return false
      const m = String(l['Data de Abertura'] || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (!m) return false
      if (mes && m[2] !== String(mes).padStart(2, '0')) return false
      if (ano && m[3] !== String(ano)) return false
      return true
    })
    .map(l => mapearLinha({
      portal: l['Portal'], titulo: l['Título'], orgao: l['Órgão'], uf: l['UF'],
      fase: l['Fase'], tags: l['Tags'], observacoes: l['Observações'],
      dataAbertura: l['Data de Abertura'], valor: l['Valor'],
    }))
}
