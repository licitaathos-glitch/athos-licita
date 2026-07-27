// Perfil de busca por empresa — grava na aba Criterios, que já existia no Apps Script
export const ABA_CRITERIOS = 'Criterios'
export const COLS_CRITERIOS = ['empresaId','empresaNome','modalidades','valorMinimo','valorMaximo',
  'ufs','palavrasChave','srp','exclusivaMEEPP','observacoes','atualizadoEm',
  'palavrasExcluidas','catmat','catser']

export const vazio = {
  palavrasChave: '', palavrasExcluidas: '', ufs: '', modalidades: '',
  valorMinimo: '', valorMaximo: '', catmat: '', catser: '',
}

// "1000, 2000" → ['1000','2000']
export const listaDe = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean)

// Normaliza texto para comparação (sem acento, minúsculo)
export const normalizar = s => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

// Calcula relevância de uma oportunidade: quais termos bateram e quantos
export function avaliarRelevancia(objeto, palavrasChave, palavrasExcluidas) {
  const texto = normalizar(objeto)
  const chaves = listaDe(palavrasChave).map(normalizar)
  const excluir = listaDe(palavrasExcluidas).map(normalizar)

  if (excluir.some(e => e && texto.includes(e))) {
    return { pontos: -1, casadas: [], excluida: true }
  }
  if (!chaves.length) return { pontos: 0, casadas: [], excluida: false }

  const casadas = listaDe(palavrasChave).filter((_, i) => chaves[i] && texto.includes(chaves[i]))
  return { pontos: casadas.length, casadas, excluida: false }
}

// Aplica todos os filtros do perfil sobre a lista vinda do PNCP
export function aplicarPerfil(oportunidades, perfil) {
  const vMin = Number(String(perfil.valorMinimo || '').replace(',', '.')) || 0
  const vMax = Number(String(perfil.valorMaximo || '').replace(',', '.')) || 0

  return oportunidades
    .map(o => ({ ...o, relevancia: avaliarRelevancia(o.objeto, perfil.palavrasChave, perfil.palavrasExcluidas) }))
    .filter(o => {
      if (o.relevancia.excluida) return false
      if (listaDe(perfil.palavrasChave).length && o.relevancia.pontos === 0) return false
      if (vMin && o.valorNum && o.valorNum < vMin) return false
      if (vMax && o.valorNum && o.valorNum > vMax) return false
      return true
    })
}
