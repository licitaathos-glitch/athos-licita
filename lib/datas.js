// Converte "dd/mm/aaaa" ou "aaaa-mm-dd" (com ou sem hora) em Date
export function parseData(valStr) {
  if (!valStr) return null
  const s = String(valStr)
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  let d = null
  if (br) d = new Date(br[3] + '-' + br[2] + '-' + br[1] + 'T12:00:00')
  else if (iso) d = new Date(iso[1] + '-' + iso[2] + '-' + iso[3] + 'T12:00:00')
  return d && !isNaN(d) ? d : null
}

// Dias restantes até a data (negativo = vencida)
export function diasRestantes(valStr) {
  const d = parseData(valStr)
  if (!d) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.ceil((d - hoje) / 86400000)
}

// Classificação de status por dias restantes
export function statusPorDias(dd) {
  if (dd === null) return 'nd'
  if (dd < 0) return 'bad'
  if (dd <= 7) return 'warn'
  return 'ok'
}

// Formata para dd/mm/aaaa
export function formatarData(valStr) {
  const d = parseData(valStr)
  return d ? d.toLocaleDateString('pt-BR') : ''
}
