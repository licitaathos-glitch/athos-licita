import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { getUsuarioFromReq, empresasVisiveis } from '@/lib/auth'
import { diasRestantes, statusPorDias, formatarData } from '@/lib/datas'

function contarItens(json) {
  try {
    const arr = JSON.parse(json || '[]')
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    const [todasEmpresas, linhas] = await Promise.all([lerAba('Empresas'), lerAba('Atas')])
    const empresas = empresasVisiveis(usuario, todasEmpresas.filter(e => e.id))
    const idsPermitidos = new Set(empresas.map(e => String(e.id).trim()))

    // A aba Atas usa "empresaId" (camelCase), diferente da aba Documentos
    const atas = linhas
      .filter(a => a.id && idsPermitidos.has(String(a.empresaId || '').trim()))
      .map(a => {
        const dd = diasRestantes(a.vencimento)
        return {
          id: a.id,
          empresa_id: String(a.empresaId || '').trim(),
          empresa_nome: a.empresaNome || '',
          numero: a.numeroAta || '',
          orgao: a.orgao || '',
          uf: a.uf || '',
          objeto: a.objeto || '',
          vigencia: a.vigencia || '',
          vencimento: formatarData(a.vencimento),
          dias: dd,
          status: statusPorDias(dd),
          itens: contarItens(a.itensJson),
          adesao: a.adesao || '',
        }
      })
      .sort((a, b) => {
        if (a.dias === null) return 1
        if (b.dias === null) return -1
        return a.dias - b.dias
      })

    return NextResponse.json({ sucesso: true, atas })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
