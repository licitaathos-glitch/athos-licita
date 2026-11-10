// O Google Sheets recusa gravar mais de 50000 caracteres numa única célula.
// Licitações com muitos itens (centenas) geram um itensJson maior que isso,
// então aqui a gente quebra o texto em pedaços e distribui em colunas
// auxiliares (itensJson, itensJson_2, itensJson_3, ...), e depois junta de
// volta na leitura. Fica transparente pro resto do código.
const TAM_CHUNK = 45000
const MAX_CHUNKS = 15

// `max` permite campos que precisam de menos colunas (o padrão é 15, o dos itens)
export function nomesChunk(base, max = MAX_CHUNKS) {
  return Array.from({ length: max }, (_, i) => (i === 0 ? base : `${base}_${i + 1}`))
}

// Recebe o texto completo e devolve um objeto { base: parte1, base_2: parte2, ... }
// pronto para espalhar nas colunas da planilha.
export function chunkCampo(base, valor, max = MAX_CHUNKS) {
  const str = valor || ''
  if (str.length > TAM_CHUNK * max) {
    throw new Error(`Campo ${base} excede o tamanho máximo suportado (muitos itens).`)
  }
  const nomes = nomesChunk(base, max)
  const partes = {}
  nomes.forEach((nome, i) => { partes[nome] = str.slice(i * TAM_CHUNK, (i + 1) * TAM_CHUNK) })
  return partes
}

// Recebe a linha lida da planilha (objeto com todas as colunas) e remonta o texto original
export function juntarChunk(linha, base, max = MAX_CHUNKS) {
  return nomesChunk(base, max).map(nome => linha[nome] || '').join('')
}
