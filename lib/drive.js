// Interpreta o que está guardado como "link do arquivo" nos documentos e atas.
// Esse campo já recebeu de tudo ao longo do tempo: link de arquivo do Drive,
// link de pasta, id solto e até endereço de site de órgão. Antes só existia o
// caso "arquivo do Drive", e qualquer outro virava um erro sem explicação.
export function analisarLinkDrive(valor) {
  const t = String(valor || '').trim()
  if (!t) return { tipo: 'vazio' }

  if (/\/folders\/[\w-]{10,}/.test(t)) return { tipo: 'pasta' }

  const noDrive = /(drive|docs)\.google\.com/i.test(t)
  const m = t.match(/\/d\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/)
  if (m && noDrive) return { tipo: 'arquivo', id: m[1] }

  // Só o id, sem endereço
  if (/^[\w-]{20,}$/.test(t)) return { tipo: 'arquivo', id: t }

  if (/^https?:\/\//i.test(t)) return { tipo: 'externo' }
  return { tipo: 'invalido' }
}
