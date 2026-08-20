import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin, empresasVisiveis } from '@/lib/auth'
import { novoId } from '@/lib/uuid'

// Colunas cadastrais completas da empresa — necessárias para preencher
// declarações e modelo de proposta de preços automaticamente a partir do
// edital. garantirAba só acrescenta as que faltarem, sem tocar nas existentes.
export const COLS_EMPRESA = [
  'id', 'nome', 'cnpj', 'responsavel', 'email', 'telefone',
  'razao_social', 'nome_fantasia', 'inscricao_estadual', 'inscricao_municipal',
  'endereco', 'numero', 'bairro', 'cidade', 'uf', 'cep',
  'rep_nome', 'rep_cpf', 'rep_rg', 'rep_cargo', 'rep_nacionalidade', 'rep_estado_civil',
  'banco', 'agencia', 'conta',
]

const CAMPOS_EDITAVEIS = COLS_EMPRESA.filter(c => c !== 'id')

function somenteCamposValidos(body) {
  const out = {}
  CAMPOS_EDITAVEIS.forEach(c => { if (body[c] !== undefined) out[c] = body[c] || '' })
  return out
}

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  await garantirAba('Empresas', COLS_EMPRESA)
  const todas = await lerAba('Empresas')
  const empresas = empresasVisiveis(usuario, todas.filter(e => e.id))
  return NextResponse.json({ sucesso: true, empresas })
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem incluir empresas.' }, { status: 403 })

  try {
    await garantirAba('Empresas', COLS_EMPRESA)
    const body = await req.json()
    if (!body.nome) return NextResponse.json({ sucesso: false, erro: 'Informe o nome da empresa.' })

    const id = novoId()
    const r = await adicionarLinha('Empresas', { id, ...somenteCamposValidos(body) })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true, id })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}

export async function PUT(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem editar empresas.' }, { status: 403 })

  try {
    await garantirAba('Empresas', COLS_EMPRESA)
    const body = await req.json()
    if (!body.id) return NextResponse.json({ sucesso: false, erro: 'Informe a empresa.' })
    if (!body.nome) return NextResponse.json({ sucesso: false, erro: 'Informe o nome da empresa.' })

    const r = await atualizarLinha('Empresas', 'id', body.id, somenteCamposValidos(body))
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}
