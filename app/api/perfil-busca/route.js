import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, podeEditar, empresasVisiveis } from '@/lib/auth'
import { ABA_CRITERIOS, COLS_CRITERIOS } from '@/lib/perfilBusca'

const CAMPOS = ['palavrasChave','palavrasExcluidas','ufs','modalidades',
  'valorMinimo','valorMaximo','catmat','catser','observacoes']

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    await garantirAba(ABA_CRITERIOS, COLS_CRITERIOS)
    const [todas, criterios] = await Promise.all([lerAba('Empresas'), lerAba(ABA_CRITERIOS)])
    const empresas = empresasVisiveis(usuario, todas.filter(e => e.id))
    const ids = new Set(empresas.map(e => String(e.id).trim()))

    const perfis = {}
    criterios.filter(c => ids.has(String(c.empresaId || '').trim())).forEach(c => {
      const p = {}
      CAMPOS.forEach(k => { p[k] = c[k] || '' })
      perfis[String(c.empresaId).trim()] = p
    })
    return NextResponse.json({ sucesso: true, perfis })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    await garantirAba(ABA_CRITERIOS, COLS_CRITERIOS)
    const b = await req.json()
    const { empresas } = await (async () => {
      const todas = await lerAba('Empresas')
      return { empresas: empresasVisiveis(usuario, todas.filter(e => e.id)) }
    })()
    const empresa = empresas.find(e => String(e.id).trim() === String(b.empresaId || '').trim())
    if (!empresa) return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })

    const campos = { atualizadoEm: new Date().toISOString(), empresaNome: empresa.nome }
    CAMPOS.forEach(k => { campos[k] = b[k] !== undefined ? b[k] : '' })

    const existentes = await lerAba(ABA_CRITERIOS)
    const ja = existentes.find(c => String(c.empresaId || '').trim() === String(b.empresaId).trim())

    const r = ja
      ? await atualizarLinha(ABA_CRITERIOS, 'empresaId', b.empresaId, campos)
      : await adicionarLinha(ABA_CRITERIOS, { empresaId: b.empresaId, ...campos })

    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao salvar: ' + e.message }, { status: 500 })
  }
}
