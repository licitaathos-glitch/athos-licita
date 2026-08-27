import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, excluirLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, podeEditar, empresasVisiveis, podeAcessarMenu, empresasComMenu } from '@/lib/auth'
import { diasRestantes, statusPorDias } from '@/lib/datas'
import { novoId } from '@/lib/uuid'

// Campos gravados na aba Atas (a aba usa empresaId em camelCase)
const CAMPOS = ['numeroAta','orgao','cnpjOrgao','uf','licitacao','processo','objeto',
  'representante','dataAssinatura','vigencia','vencimento','adesao','condPagamento',
  'contato','emailOrgao','telefoneOrgao','observacoes','itensJson','licitacaoId',
  // PDF da ata guardado no Drive: antes o arquivo era só lido pela IA e
  // descartado, então não havia como rever ou baixar depois
  'arquivoUrl','arquivoNome']

// Colunas que a aba Atas precisa ter. adicionarLinha só grava colunas que existem
// no cabeçalho — se faltar alguma (id, empresaId...), a ata é gravada sem ela e
// some da listagem. garantirAba acrescenta as que faltarem antes de qualquer uso.
const COLS_ATA = ['id','empresaId','empresaNome','fornecedor','cnpjFornecedor',
  ...CAMPOS, 'salvoEm']

function contarItens(json) {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : [] } catch { return [] }
}

async function contexto(usuario) {
  await garantirAba('Atas', COLS_ATA)
  const todas = await lerAba('Empresas')
  const empresas = empresasComMenu(usuario, 'atas', todas.filter(e => e.id))
  return { empresas, ids: new Set(empresas.map(e => String(e.id).trim())) }
}

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'atas')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })

  try {
    const [{ ids }, linhas] = await Promise.all([contexto(usuario), lerAba('Atas')])

    const atas = linhas
      .filter(a => a.id && ids.has(String(a.empresaId || '').trim()))
      .map(a => {
        const itens = contarItens(a.itensJson)
        const valorTotal = itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), 0)
        const dd = diasRestantes(a.vencimento)
        return {
          id: a.id,
          empresa_id: String(a.empresaId || '').trim(),
          empresa_nome: a.empresaNome || '',
          numeroAta: a.numeroAta || '', orgao: a.orgao || '', cnpjOrgao: a.cnpjOrgao || '',
          uf: a.uf || '', licitacao: a.licitacao || '', processo: a.processo || '',
          objeto: a.objeto || '', representante: a.representante || '',
          dataAssinatura: a.dataAssinatura || '', vigencia: a.vigencia || '',
          vencimento: a.vencimento || '', adesao: a.adesao || '',
          condPagamento: a.condPagamento || '', contato: a.contato || '',
          emailOrgao: a.emailOrgao || '', telefoneOrgao: a.telefoneOrgao || '',
          observacoes: a.observacoes || '', licitacaoId: a.licitacaoId || '',
          arquivoUrl: a.arquivoUrl || '', arquivoNome: a.arquivoNome || '',
          itens, valorTotal,
          dias: dd, status: statusPorDias(dd),
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

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'atas')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const b = await req.json()
    const { empresas, ids } = await contexto(usuario)
    if (!ids.has(String(b.empresa_id || '').trim())) {
      return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })
    }
    if (!b.numeroAta) return NextResponse.json({ sucesso: false, erro: 'Nº da ata é obrigatório.' })

    const campos = {}
    CAMPOS.forEach(c => { campos[c] = b[c] !== undefined ? b[c] : '' })

    if (b.id) {
      const r = await atualizarLinha('Atas', 'id', b.id, campos)
      if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
      return NextResponse.json({ sucesso: true, id: b.id })
    }

    // Evita duplicar a mesma ata (nº + empresa) — antes não havia nenhuma
    // checagem aqui, então o mesmo edital linkado de novo no dropdown criava
    // uma segunda ata idêntica (caso Porto Ferreira).
    if (b.numeroAta) {
      const linhas = await lerAba('Atas')
      const dup = linhas.find(a =>
        String(a.numeroAta || '').trim().toUpperCase() === String(b.numeroAta).trim().toUpperCase() &&
        String(a.empresaId || '').trim() === String(b.empresa_id).trim())
      if (dup) return NextResponse.json({ sucesso: false, erro: `Já existe uma ata nº ${b.numeroAta} cadastrada para esta empresa.`, duplicada: true })
    }

    const empresa = empresas.find(e => String(e.id).trim() === String(b.empresa_id).trim())
    const id = novoId()
    const r = await adicionarLinha('Atas', {
      id,
      empresaId: b.empresa_id,
      empresaNome: empresa?.nome || '',
      fornecedor: empresa?.nome || '',
      cnpjFornecedor: empresa?.cnpj || '',
      ...campos,
      salvoEm: new Date().toISOString(),
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })

    // Confere se a linha realmente entrou e com a empresa certa. Sem isso o
    // sistema já respondeu "salvou" para atas que não apareciam na lista.
    const conferir = (await lerAba('Atas')).find(a => String(a.id || '').trim() === id)
    if (!conferir) {
      return NextResponse.json({ sucesso: false, erro: 'A ata não foi gravada na planilha. Tente de novo.' })
    }
    if (String(conferir.empresaId || '').trim() !== String(b.empresa_id).trim()) {
      return NextResponse.json({ sucesso: false, erro: 'A ata foi gravada sem a empresa e não apareceria na lista. Confira o cabeçalho da aba Atas.' })
    }
    return NextResponse.json({ sucesso: true, id })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao salvar: ' + e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'atas')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ sucesso: false, erro: 'ID obrigatório.' })

    const [{ ids }, linhas] = await Promise.all([contexto(usuario), lerAba('Atas')])
    const ata = linhas.find(a => String(a.id || '').trim() === String(id).trim())
    if (!ata) return NextResponse.json({ sucesso: false, erro: 'Ata não encontrada.' })
    if (!ids.has(String(ata.empresaId || '').trim())) {
      return NextResponse.json({ sucesso: false, erro: 'Sem permissão.' }, { status: 403 })
    }

    const r = await excluirLinha('Atas', 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao excluir: ' + e.message }, { status: 500 })
  }
}
