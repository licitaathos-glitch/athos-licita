import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, excluirLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, podeEditar, empresasVisiveis, podeAcessarMenu } from '@/lib/auth'
import { novoId } from '@/lib/uuid'
import { ABA_EMPENHOS, COLS_EMPENHOS, ABA_CONFIG, COLS_CONFIG, calcularEmpenho } from '@/lib/comercial'

const CAMPOS = ['ataId','numeroAta','orgao','itemNumero','itemDescricao','numeroEmpenho',
  'dataEmpenho','quantidade','valorUnitario','custoUnitario','status','notaFiscal',
  'dataFaturamento','dataPagamento','observacao']

async function contexto(usuario) {
  await Promise.all([
    garantirAba(ABA_EMPENHOS, COLS_EMPENHOS),
    garantirAba(ABA_CONFIG, COLS_CONFIG),
  ])
  const [todas, configs] = await Promise.all([lerAba('Empresas'), lerAba(ABA_CONFIG)])
  const empresas = empresasVisiveis(usuario, todas.filter(e => e.id))
  const mapaConfig = {}
  configs.forEach(c => { mapaConfig[String(c.empresaId || '').trim()] = c })
  return { empresas, ids: new Set(empresas.map(e => String(e.id).trim())), mapaConfig }
}

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'financeiro')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })

  try {
    const { ids, mapaConfig } = await contexto(usuario)
    const linhas = await lerAba(ABA_EMPENHOS)

    const empenhos = linhas
      .filter(e => e.id && ids.has(String(e.empresaId || '').trim()))
      .map(e => {
        const empId = String(e.empresaId || '').trim()
        const calc = calcularEmpenho(e, mapaConfig[empId])
        return {
          id: e.id, empresa_id: empId, empresa_nome: e.empresaNome || '',
          ataId: e.ataId || '', numeroAta: e.numeroAta || '', orgao: e.orgao || '',
          itemNumero: e.itemNumero || '', itemDescricao: e.itemDescricao || '',
          numeroEmpenho: e.numeroEmpenho || '', dataEmpenho: e.dataEmpenho || '',
          status: e.status || 'Empenhado', notaFiscal: e.notaFiscal || '',
          dataFaturamento: e.dataFaturamento || '', dataPagamento: e.dataPagamento || '',
          observacao: e.observacao || '',
          ...calc,
        }
      })
      .sort((a, b) => String(b.dataEmpenho).split('/').reverse().join('')
        .localeCompare(String(a.dataEmpenho).split('/').reverse().join('')))

    return NextResponse.json({ sucesso: true, empenhos })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'financeiro')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const b = await req.json()
    const { empresas, ids } = await contexto(usuario)
    if (!ids.has(String(b.empresa_id || '').trim())) {
      return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })
    }
    if (!b.numeroEmpenho) return NextResponse.json({ sucesso: false, erro: 'Informe o número da nota de empenho.' })

    const campos = {}
    CAMPOS.forEach(c => { if (b[c] !== undefined) campos[c] = b[c] })

    if (b.id) {
      const r = await atualizarLinha(ABA_EMPENHOS, 'id', b.id, campos)
      if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
      return NextResponse.json({ sucesso: true, id: b.id })
    }

    const empresa = empresas.find(e => String(e.id).trim() === String(b.empresa_id).trim())
    const id = novoId()
    const r = await adicionarLinha(ABA_EMPENHOS, {
      id,
      empresaId: b.empresa_id,
      empresaNome: empresa?.nome || '',
      status: b.status || 'Empenhado',
      ...campos,
      criadoEm: new Date().toISOString(),
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true, id })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao salvar: ' + e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'financeiro')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id } = await req.json()
    const { ids } = await contexto(usuario)
    const linhas = await lerAba(ABA_EMPENHOS)
    const emp = linhas.find(e => String(e.id || '').trim() === String(id).trim())
    if (!emp) return NextResponse.json({ sucesso: false, erro: 'Empenho não encontrado.' })
    if (!ids.has(String(emp.empresaId || '').trim())) {
      return NextResponse.json({ sucesso: false, erro: 'Sem permissão.' }, { status: 403 })
    }
    const r = await excluirLinha(ABA_EMPENHOS, 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao excluir: ' + e.message }, { status: 500 })
  }
}
