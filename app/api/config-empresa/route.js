import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin, empresasVisiveis } from '@/lib/auth'
import { ABA_CONFIG, COLS_CONFIG } from '@/lib/comercial'

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    await garantirAba(ABA_CONFIG, COLS_CONFIG)
    const [todas, configs] = await Promise.all([lerAba('Empresas'), lerAba(ABA_CONFIG)])
    const empresas = empresasVisiveis(usuario, todas.filter(e => e.id))
    const ids = new Set(empresas.map(e => String(e.id).trim()))

    const mapa = {}
    configs.filter(c => ids.has(String(c.empresaId || '').trim())).forEach(c => {
      mapa[String(c.empresaId).trim()] = {
        modelo: c.modelo || 'revenda',
        percentualComissao: c.percentualComissao || '',
        observacao: c.observacao || '',
      }
    })
    return NextResponse.json({ sucesso: true, configs: mapa })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores.' }, { status: 403 })

  try {
    await garantirAba(ABA_CONFIG, COLS_CONFIG)
    const { empresaId, modelo, percentualComissao, observacao } = await req.json()
    if (!empresaId) return NextResponse.json({ sucesso: false, erro: 'Empresa obrigatória.' })

    const campos = {
      modelo: modelo || 'revenda',
      percentualComissao: percentualComissao || '',
      observacao: observacao || '',
      atualizadoEm: new Date().toISOString(),
    }

    const existentes = await lerAba(ABA_CONFIG)
    const ja = existentes.find(c => String(c.empresaId || '').trim() === String(empresaId).trim())

    const r = ja
      ? await atualizarLinha(ABA_CONFIG, 'empresaId', empresaId, campos)
      : await adicionarLinha(ABA_CONFIG, { empresaId, ...campos })

    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao salvar: ' + e.message }, { status: 500 })
  }
}
