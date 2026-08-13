// Exportação para Excel. A biblioteca xlsx já estava no projeto (usada na
// importação da planilha do Licitei), então dá para gerar um .xlsx de verdade
// em vez de um CSV que o Excel abre torto por causa do acento e do ponto e
// vírgula. Tudo roda no navegador — nenhum dado sai para outro servidor.
import * as XLSX from 'xlsx'

const limpar = t => String(t || '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)

/**
 * @param {object[]} linhas   objetos já no formato final (chave = cabeçalho)
 * @param {string}   arquivo  nome do arquivo, sem extensão
 * @param {string}   aba      nome da aba dentro da planilha
 */
export function exportarExcel(linhas, arquivo = 'export', aba = 'Dados') {
  if (!linhas?.length) return false
  const ws = XLSX.utils.json_to_sheet(linhas)

  // Largura de coluna pelo maior conteúdo, senão descrição longa fica ilegível
  const chaves = Object.keys(linhas[0])
  ws['!cols'] = chaves.map(k => ({
    wch: Math.min(60, Math.max(12, ...linhas.map(l => String(l[k] ?? '').length), k.length)),
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, limpar(aba) || 'Dados')
  XLSX.writeFile(wb, `${limpar(arquivo)}.xlsx`)
  return true
}

// Converte "R$ 1.234,56" ou "1234,56" em número, para o Excel somar de verdade
export const numero = v => {
  // Texto sem dígito ("Sigiloso", "—", vazio) tem que virar célula VAZIA, não
  // zero: zero no Excel entra na soma e distorce o total.
  const limpo = String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  if (!/\d/.test(limpo)) return ''
  const n = Number(limpo)
  return isNaN(n) ? '' : n
}
