import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { getUsuarioFromReq, empresasVisiveis } from '@/lib/auth'
import { diasRestantes, statusPorDias, formatarData } from '@/lib/datas'
import { rotuloTipo, SLUGS_COM_VALIDADE } from '@/lib/tiposCertidao'

// Procura, entre os campos da linha, o primeiro que pareça um link do Drive
function acharLink(doc) {
  for (const v of Object.values(doc)) {
    const s = String(v || '')
    if (s.startsWith('http')) return s
  }
  return ''
}

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    const [todasEmpresas, documentos] = await Promise.all([lerAba('Empresas'), lerAba('Documentos')])
    const empresas = empresasVisiveis(usuario, todasEmpresas.filter(e => e.id))
    const idsPermitidos = new Set(empresas.map(e => String(e.id).trim()))
    const nomePorId = Object.fromEntries(empresas.map(e => [String(e.id).trim(), e.nome]))

    const certidoes = documentos
      .filter(d => idsPermitidos.has(String(d.empresa_id || '').trim()))
      .map(d => {
        const slug = String(d.tipo_slug || '').trim()
        const temValidade = SLUGS_COM_VALIDADE.has(slug)
        const dd = temValidade ? diasRestantes(d.validade) : null
        return {
          id: d.id,
          empresa_id: String(d.empresa_id || '').trim(),
          empresa_nome: nomePorId[String(d.empresa_id || '').trim()] || '',
          tipo_slug: slug,
          tipo: rotuloTipo(slug),
          validade: formatarData(d.validade),
          dias: dd,
          status: temValidade ? statusPorDias(dd) : 'nd',
          observacao: d.observacao || '',
          link: acharLink(d),
        }
      })
      .sort((a, b) => {
        if (a.dias === null) return 1
        if (b.dias === null) return -1
        return a.dias - b.dias
      })

    return NextResponse.json({ sucesso: true, certidoes, empresas })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
