// O Google Sheets recusa gravar mais de 50000 caracteres numa única célula.
// Licitações com muitos itens (centenas) geram um itensJson maior que isso,
// então aqui a gente quebra o texto em pedaços e distribui em colunas
// auxiliares (itensJson, itensJson_2, itensJson_3, ...), e depois junta de
// volta na leitura. Fica transparente pro resto do código.
const TAM_CHUNK = 45000
const MAX_CHUNKS = 15

export function nomesChunk(base) {
  return Array.from({ length: MAX_CHUNKS }, (_, i) => (i === 0 ? base : `${base}_${i + 1}`))
}

// Recebe o texto completo e devolve um objeto { base: parte1, base_2: parte2, ... }
// pronto para espalhar nas colunas da planilha.
export function chunkCampo(base, valor) {
  const str = valor || ''
  if (str.length > TAM_CHUNK * MAX_CHUNKS) {
    throw new Error(`Campo ${base} excede o tamanho máximo suportado (muitos itens).`)
  }
  const nomes = nomesChunk(base)
  const partes = {}
  nomes.forEach((nome, i) => { partes[nome] = str.slice(i * TAM_CHUNK, (i + 1) * TAM_CHUNK) })
  return partes
}

// Recebe a linha lida da planilha (objeto com todas as colunas) e remonta o texto original
export function juntarChunk(linha, base) {
  return nomesChunk(base).map(nome => linha[nome] || '').join('')
}
