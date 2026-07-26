import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { lerToken } from '@/lib/session'

// Slugs de documentos que possuem validade (mesma regra do sistema atual)
const SLUGS_COM_VALIDADE = new Set([
  'rfb_pgfn','fgts','tst','reg_est','reg_mun','pge',
  'alvara_san','anvisa','eng','crea_pj','crea_pf',
  'bal_ult','bal_pen','falencia','atst',
])

function diffDias(valStr) {
  if (!valStr) return null
  let d = null
  const br = String(valStr).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  const iso = String(valStr).match(/(\d{4})-(\d{2})-(\d{2})/)
  if (br) d = new Date(br[3] + '-' + br[2] + '-' + br[1] + 'T12:00:00')
  else if (iso) d = new Date(iso[1] + '-' + iso[2] + '-' + iso[3] + 'T12:00:00')
  if (!d || isNaN(d)) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.ceil((d - hoje) / 86400000)
}

export async function GET(req) {
  try {
    const token = req.cookies.get('athos_sessao')?.value
    const usuario = token ? await lerToken(token) : null
    if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

    const [empresas, documentos] = await Promise.all([lerAba('Empresas'), lerAba('Documentos')])

    const resumo = empresas.filter(e => e.id).map(e => {
      const docs = documentos.filter(d =>
        String(d.empresa_id || '').trim() === String(e.id).trim() &&
        SLUGS_COM_VALIDADE.has(String(d.tipo_slug || '').trim())
      )
      let vencidas = 0, alerta = 0, regulares = 0
      docs.forEach(d => {
        const dd = diffDias(d.validade)
        if (dd === null) return
        if (dd < 0) vencidas++
        else if (dd <= 7) alerta++
        else regulares++
      })
      const status = vencidas ? 'bad' : alerta ? 'warn' : regulares ? 'ok' : 'nd'
      return { id: e.id, nome: e.nome, cnpj: e.cnpj, responsavel: e.responsavel || '', vencidas, alerta, regulares, status }
    })

    return NextResponse.json({
      sucesso: true,
      usuario,
      totais: {
        empresas: resumo.length,
        vencidas: resumo.reduce((a, b) => a + b.vencidas, 0),
        alerta: resumo.reduce((a, b) => a + b.alerta, 0),
      },
      empresas: resumo,
    })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
