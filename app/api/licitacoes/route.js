import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, excluirLinha, garantirAba } from '@/lib/google'
import { COLS_RESULTADO } from '@/lib/resultado'
import { faseAutomatica, faseInferida } from '@/lib/fases'
import { getUsuarioFromReq, podeEditar, empresasVisiveis, podeAcessarMenu, empresasComMenu } from '@/lib/auth'
import { novoId } from '@/lib/uuid'
import { chunkCampo, juntarChunk, nomesChunk } from '@/lib/chunkCampo'
import { COLS_COTACAO } from '@/lib/cotacao'

const CAMPOS = ['numeroPNCP','numeroEdital','objeto','orgao','uasg','uf','valor','dataAbertura',
  'dataLimite','dataSessao','modalidade','status','link','portal','srp','numeroProposta','anexoDriveId','anexoDriveUrl','anexosJson',
  'itensJson','checklistJson','resumoEmailsJson','participar', 'fase', ...COLS_RESULTADO]

// itensJson vem em várias colunas (itensJson, itensJson_2, ...) porque licitações
// com muitos itens passam do limite de 50000 caracteres de uma única célula do Sheets
const COLS_LIC = ['id','empresaId','empresaNome','numeroPNCP','numeroEdital','objeto','orgao','uasg','uf',
  'valor','dataPublicacao','dataAbertura','modalidade','status','link','origem','salvoEm',
  'dataLimite','dataSessao','portal','srp','numeroProposta','anexoDriveId','anexoDriveUrl','anexosJson',
  ...nomesChunk('itensJson'), 'checklistJson', 'resumoEmailsJson',
  'participar', 'fase', ...COLS_RESULTADO]

function parseItens(json) {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : [] } catch { return [] }
}

// Mapa licitacaoId -> { pendentes, respondidas, total } dos pedidos de cotacao
// enviados a fornecedores. Se a aba ainda nao existir ou der erro, devolve mapa
// vazio — nunca derruba a listagem.
async function mapaCotacoes() {
  try {
    await garantirAba('Cotacoes', COLS_COTACAO)
    const mapa = {}
    for (const c of await lerAba('Cotacoes')) {
      const lid = String(c.licitacaoId || '').trim()
      if (!lid) continue
      if (!mapa[lid]) mapa[lid] = { pendentes: 0, respondidas: 0, total: 0 }
      mapa[lid].total++
      if (String(c.status || 'Pendente').trim() === 'Respondida') mapa[lid].respondidas++
      else mapa[lid].pendentes++
    }
    return mapa
  } catch { return {} }
}

// Etapa do preco/cotacao, para o selo da lista:
//   'pendente'    — pedido de cotacao enviado, fornecedor ainda nao respondeu
//   'precificada' — todos os itens participando ja tem Valor minimo preenchido
//                   (vale mesmo sem pedido de cotacao — o preco pode ter sido
//                   definido direto na Inscricao de proposta)
//   'respondida'  — fornecedor respondeu, mas ainda falta preco em algum item
function etapaCotacao(cot, itens) {
  const participando = itens.filter(it => it.participar)
  const comValor = participando.filter(it => String(it.meuValor ?? '').trim() !== '')
  const precificada = participando.length > 0 && comValor.length === participando.length

  if (cot && cot.pendentes > 0) return 'pendente'
  if (precificada) return 'precificada'
  if (cot && cot.total > 0) return 'respondida'
  return ''
}

async function contexto(usuario) {
  await garantirAba('Licitacoes', COLS_LIC)
  const todas = await lerAba('Empresas')
  const empresas = empresasComMenu(usuario, 'licitacoes', todas.filter(e => e.id))
  return { empresas, ids: new Set(empresas.map(e => String(e.id).trim())) }
}

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })

  try {
    const [{ ids }, linhas, cotacoes] = await Promise.all([
      contexto(usuario), lerAba('Licitacoes'), mapaCotacoes(),
    ])
    const licitacoes = linhas
      .filter(l => l.id && ids.has(String(l.empresaId || '').trim()))
      .map(l => ({
        id: l.id,
        empresa_id: String(l.empresaId || '').trim(),
        empresa_nome: l.empresaNome || '',
        numeroPNCP: l.numeroPNCP || '', numeroEdital: l.numeroEdital || '',
        objeto: l.objeto || '', orgao: l.orgao || '', uasg: l.uasg || '', uf: l.uf || '',
        valor: l.valor || '', dataAbertura: l.dataAbertura || '', dataLimite: l.dataLimite || '', dataSessao: l.dataSessao || '',
        modalidade: l.modalidade || '', portal: l.portal || '',
        status: l.status || 'Aberta', srp: l.srp || 'Não', link: l.link || '',
        anexoDriveUrl: l.anexoDriveUrl || '', anexoDriveId: l.anexoDriveId || '',
        anexos: parseItens(l.anexosJson),
        itens: parseItens(juntarChunk(l, 'itensJson')), checklistJson: l.checklistJson || '',
        resumoEmailsJson: l.resumoEmailsJson || '',
        participar: l.participar || 'Pendente',
        fase: faseAutomatica({
          fase: faseInferida({ fase: l.fase, resultado: l.resultado, participar: l.participar, status: l.status }),
          dataSessao: l.dataSessao, dataLimite: l.dataLimite, dataAbertura: l.dataAbertura,
        }),
        resultado: l.resultado || 'Aguardando',
        motivo: l.motivo || '',
        nossoLance: l.nossoLance || '',
        valorVencedor: l.valorVencedor || '',
        empresaVencedora: l.empresaVencedora || '',
        colocacao: l.colocacao || '',
        observacaoDisputa: l.observacaoDisputa || '', dataHomologacao: l.dataHomologacao || '',
        cotacoesPendentes: (cotacoes[String(l.id).trim()] || {}).pendentes || 0,
        cotacoesRespondidas: (cotacoes[String(l.id).trim()] || {}).respondidas || 0,
        cotacoesTotal: (cotacoes[String(l.id).trim()] || {}).total || 0,
        cotacaoEtapa: etapaCotacao(cotacoes[String(l.id).trim()], parseItens(juntarChunk(l, 'itensJson'))),
        salvoEm: l.salvoEm || '',
      }))
      .sort((a, b) => String(b.salvoEm).localeCompare(String(a.salvoEm)))

    return NextResponse.json({ sucesso: true, licitacoes })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const b = await req.json()
    const { empresas, ids } = await contexto(usuario)
    if (!ids.has(String(b.empresa_id || '').trim())) {
      return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })
    }
    if (!b.objeto && !b.numeroEdital) {
      return NextResponse.json({ sucesso: false, erro: 'Informe ao menos o objeto ou o nº do edital.' })
    }

    const campos = {}
    CAMPOS.forEach(c => { if (b[c] !== undefined) campos[c] = b[c] })
    if (campos.itensJson !== undefined) {
      try { Object.assign(campos, chunkCampo('itensJson', campos.itensJson)) }
      catch (e) { return NextResponse.json({ sucesso: false, erro: e.message }) }
    }

    if (b.id) {
      const r = await atualizarLinha('Licitacoes', 'id', b.id, campos)
      if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
      return NextResponse.json({ sucesso: true, id: b.id })
    }

    // Evita duplicar a mesma licitação para a mesma empresa
    if (b.numeroPNCP) {
      const linhas = await lerAba('Licitacoes')
      const dup = linhas.find(l =>
        String(l.numeroPNCP || '').trim() === String(b.numeroPNCP).trim() &&
        String(l.empresaId || '').trim() === String(b.empresa_id).trim())
      if (dup) return NextResponse.json({ sucesso: false, erro: 'Esta licitação já está salva para esta empresa.', duplicada: true })
    }

    const empresa = empresas.find(e => String(e.id).trim() === String(b.empresa_id).trim())
    const id = novoId()
    const r = await adicionarLinha('Licitacoes', {
      id,
      empresaId: b.empresa_id,
      empresaNome: empresa?.nome || '',
      dataPublicacao: b.dataPublicacao || '',
      origem: b.origem || 'manual',
      participar: b.participar || 'Pendente',
      status: b.status || 'Aberta',
      srp: b.srp || 'Não',
      itensJson: b.itensJson || '[]',
      ...campos,
      salvoEm: new Date().toISOString(),
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
  if (!podeAcessarMenu(usuario, 'licitacoes')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id } = await req.json()
    const [{ ids }, linhas] = await Promise.all([contexto(usuario), lerAba('Licitacoes')])
    const lic = linhas.find(l => String(l.id || '').trim() === String(id).trim())
    if (!lic) return NextResponse.json({ sucesso: false, erro: 'Licitação não encontrada.' })
    if (!ids.has(String(lic.empresaId || '').trim())) {
      return NextResponse.json({ sucesso: false, erro: 'Sem permissão.' }, { status: 403 })
    }
    const r = await excluirLinha('Licitacoes', 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao excluir: ' + e.message }, { status: 500 })
  }
}
