import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin, empresasVisiveis } from '@/lib/auth'
import { novoId } from '@/lib/uuid'
import { COLS_RESULTADO } from '@/lib/resultado'

// Grava de fato os registros que o Adm revisou e confirmou na pré-visualização.
export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Somente administradores podem importar em lote.' }, { status: 403 })

  try {
    const { empresaId, registros } = await req.json()
    if (!empresaId || !Array.isArray(registros) || !registros.length) {
      return NextResponse.json({ sucesso: false, erro: 'Nada para importar.' })
    }

    const todas = await lerAba('Empresas')
    const empresa = empresasVisiveis(usuario, todas.filter(e => e.id)).find(e => String(e.id).trim() === String(empresaId).trim())
    if (!empresa) return NextResponse.json({ sucesso: false, erro: 'Empresa não encontrada ou sem acesso.' })

    const COLS_LIC = ['id','empresaId','empresaNome','numeroPNCP','numeroEdital','objeto','orgao','uf',
      'valor','dataPublicacao','dataAbertura','modalidade','status','link','origem','salvoEm',
      'dataLimite','dataSessao','portal','srp','anexoDriveId','anexoDriveUrl','anexosJson','itensJson','checklistJson',
      'participar', 'fase', ...COLS_RESULTADO]
    await garantirAba('Licitacoes', COLS_LIC)

    let inseridos = 0
    const erros = []
    for (const r of registros) {
      const id = novoId()
      const res = await adicionarLinha('Licitacoes', {
        id, empresaId, empresaNome: empresa.nome,
        numeroEdital: r.numeroEdital || '', objeto: r.objeto || '',
        orgao: r.orgao || '', uf: r.uf || '', portal: r.portal || '',
        valor: r.valor || '', dataAbertura: r.dataAbertura || '', dataSessao: r.dataSessao || '',
        dataLimite: '', modalidade: '', numeroPNCP: '',
        fase: r.fase || 'Em analise', status: r.status || 'Aberta',
        resultado: r.resultado || 'Aguardando', motivo: r.motivo || '',
        participar: r.participar || 'Pendente', srp: 'Não',
        itensJson: '[]', anexoDriveId: '', anexoDriveUrl: '', anexosJson: '[]',
        origem: 'importacao_licitei', salvoEm: new Date().toISOString(),
      })
      if (res.ok) inseridos++
      else erros.push({ registro: r.numeroEdital, erro: res.erro })
    }

    return NextResponse.json({ sucesso: true, inseridos, total: registros.length, erros })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao importar: ' + e.message }, { status: 500 })
  }
}
