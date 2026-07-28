import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { lerAba } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin, empresasVisiveis } from '@/lib/auth'
import { filtrarELinhas } from '@/lib/importLicitei'

export const maxDuration = 60

// Só monta a pré-visualização — nada é gravado aqui. Importação em lote é
// operação sensível o bastante para exigir revisão antes de confirmar.
export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Somente administradores podem importar em lote.' }, { status: 403 })

  try {
    const { base64, empresaId, mes, ano, palavraEmpresa } = await req.json()
    if (!base64 || !empresaId) return NextResponse.json({ sucesso: false, erro: 'Arquivo e empresa são obrigatórios.' })

    const todas = await lerAba('Empresas')
    const empresa = empresasVisiveis(usuario, todas.filter(e => e.id)).find(e => String(e.id).trim() === String(empresaId).trim())
    if (!empresa) return NextResponse.json({ sucesso: false, erro: 'Empresa não encontrada ou sem acesso.' })

    const wb = XLSX.read(Buffer.from(base64, 'base64'), { type: 'buffer' })
    const nomeAba = wb.SheetNames.includes('Dados') ? 'Dados' : wb.SheetNames[0]
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], { defval: '' })

    if (!linhas.length) return NextResponse.json({ sucesso: false, erro: 'A planilha não tem linhas na aba "Dados".' })

    const colunasEsperadas = ['Portal', 'Título', 'Órgão', 'UF', 'Fase', 'Tags', 'Observações', 'Data de Abertura', 'Valor']
    const colunasFaltando = colunasEsperadas.filter(c => !(c in linhas[0]))
    if (colunasFaltando.length) {
      return NextResponse.json({ sucesso: false, erro: 'Colunas não reconhecidas na planilha: ' + colunasFaltando.join(', ') + '. Esperado o formato de exportação do Licitei.' })
    }

    const registros = filtrarELinhas(linhas, { mes, ano, palavraEmpresa: palavraEmpresa || empresa.nome })

    // Marca quais já existem na base, para não duplicar na confirmação
    const existentes = await lerAba('Licitacoes')
    const jaTemNoBanco = new Set(
      existentes.filter(l => String(l.empresaId || '').trim() === String(empresaId).trim())
        .map(l => (l.numeroEdital || '').trim().toUpperCase() + '|' + (l.orgao || '').trim().toUpperCase())
    )
    registros.forEach(r => {
      r._jaExiste = jaTemNoBanco.has(r.numeroEdital.trim().toUpperCase() + '|' + r.orgao.trim().toUpperCase())
    })

    return NextResponse.json({
      sucesso: true, empresaNome: empresa.nome,
      totalNaPlanilha: linhas.length, registros,
    })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao processar a planilha: ' + e.message }, { status: 500 })
  }
}
