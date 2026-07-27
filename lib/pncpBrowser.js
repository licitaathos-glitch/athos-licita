'use client'
import { montarConsultas, consolidar } from './pncpComum'

const espera = ms => new Promise(r => setTimeout(r, ms))

// Consulta o PNCP direto do navegador do usuário.
// Vantagem: usa o IP da conexão dele, que não sofre o limite por IP compartilhado
// que atinge os servidores da Vercel.
export async function buscarNoNavegador({ dias, ufs, modalidades, termo }) {
  const { consultas, periodo } = montarConsultas({ dias, ufs, modalidades })
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
