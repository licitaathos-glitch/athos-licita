'use client'
import { montarConsultas, consolidar } from './pncpComum'

const espera = ms => new Promise(r => setTimeout(r, ms))

// Consulta o PNCP direto do navegador do usuário.
// Vantagem: usa o IP da conexão dele, que não sofre o limite por IP compartilhado
// que atinge os servidores da Vercel.
export async function buscarNoNavegador({ dias, ufs, modalidades, termo, uasg = '', cnpjOrgao = '' }) {
  const { consultas, periodo } = montarConsultas({ dias, ufs, modalidades, uasg, cnpjOrgao })
  const brutos = []
  const diagnostico = []
  let bloqueioCORS = false

  for (const c of consultas) {
    let pagina = 1
    let totalPaginas = 1
    while (pagina <= totalPaginas && pagina <= c.maxPaginas) {
      try {
        const r = await fetch(c.urlDe(pagina), { headers: { Accept: 'application/json' } })
        if (r.status === 204) { diagnostico.push(`${c.uf}/mod${c.mod}: sem resultados`); break }
        if (r.status === 429) {
          diagnostico.push(`${c.uf}/mod${c.mod}: limite de requisições — aguardando`)
          await espera(3000)
          continue
        }
        if (!r.ok) { diagnostico.push(`${c.uf}/mod${c.mod} p${pagina}: HTTP ${r.status}`); break }
        const json = await r.json()
        const itens = Array.isArray(json) ? json : (json.data || json.content || [])
        if (!itens.length) break
        totalPaginas = json.totalPaginas || json.totalPages || 1
        itens.forEach(item => brutos.push({ item, uf: c.uf }))
        pagina++
        await espera(350)
      } catch (e) {
        // Falha de rede a partir do navegador costuma ser bloqueio de CORS
        bloqueioCORS = true
        diagnostico.push(`${c.uf}/mod${c.mod}: ${e.message}`)
        break
      }
    }
  }

  return { resultados: consolidar(brutos, termo), diagnostico, periodo, bloqueioCORS }
}

// Consulta os itens de uma contratação e verifica se algum código CATMAT/CATSER bate.
// O nome do campo do catálogo varia conforme a origem, então a checagem varre
// todos os valores do item em vez de depender de um campo específico.
export async function verificarCatalogo(oportunidades, codigos, limite = 40) {
  const alvos = codigos.map(c => String(c).trim()).filter(Boolean)
  if (!alvos.length) return oportunidades

  const saida = []
  for (const op of oportunidades.slice(0, limite)) {
    const m = String(op.numeroPNCP || '').match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/)
    if (!m) { saida.push(op); continue }
    const [, cnpj, seq, ano] = m
    try {
      const r = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${parseInt(seq)}/itens?pagina=1&tamanhoPagina=100`,
        { headers: { Accept: 'application/json' } })
      if (!r.ok) { saida.push(op); continue }
      const arr = await r.json()
      const itens = Array.isArray(arr) ? arr : (arr.data || [])
      const bateu = []
      itens.forEach(it => {
        const valores = Object.values(it).map(v => String(v ?? ''))
        alvos.forEach(cod => { if (valores.includes(cod) && !bateu.includes(cod)) bateu.push(cod) })
      })
      saida.push({ ...op, catalogoCasado: bateu, itensVerificados: itens.length })
      await espera(250)
    } catch {
      saida.push(op)
    }
  }
  return [...saida, ...oportunidades.slice(limite)]
}
