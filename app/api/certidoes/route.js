import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, excluirLinha } from '@/lib/google'
import { getUsuarioFromReq, podeEditar, empresasVisiveis } from '@/lib/auth'
import { diasRestantes, statusPorDias, formatarData } from '@/lib/datas'
import { rotuloTipo, temValidade } from '@/lib/tiposCertidao'
import { novoId } from '@/lib/uuid'

async function idsPermitidos(usuario) {
  const todas = await lerAba('Empresas')
  const empresas = empresasVisiveis(usuario, todas.filter(e => e.id))
  return {
    empresas,
    ids: new Set(empresas.map(e => String(e.id).trim())),
    nomePorId: Object.fromEntries(empresas.map(e => [String(e.id).trim(), e.nome])),
  }
}

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })

  try {
    const [{ ids, nomePorId, empresas }, documentos] = await Promise.all([
      idsPermitidos(usuario), lerAba('Documentos'),
    ])

    const certidoes = documentos
      .filter(d => d.id && ids.has(String(d.empresa_id || '').trim()))
      .map(d => {
        const slug = String(d.tipo_slug || '').trim()
        const comVal = temValidade(slug)
        const dd = comVal ? diasRestantes(d.validade) : null
        return {
          id: d.id,
          empresa_id: String(d.empresa_id || '').trim(),
          empresa_nome: nomePorId[String(d.empresa_id || '').trim()] || '',
          tipo_slug: slug,
          tipo: rotuloTipo(slug),
          tem_validade: comVal,
          validade: formatarData(d.validade),
          validade_iso: (() => {
            const m = String(d.validade || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
            if (m) return m[3] + '-' + m[2] + '-' + m[1]
            const iso = String(d.validade || '').match(/(\d{4})-(\d{2})-(\d{2})/)
            return iso ? iso[0] : ''
          })(),
          dias: dd,
          status: comVal ? statusPorDias(dd) : 'nd',
          observacao: d.observacao || '',
          link: d.drive_file_url || '',
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

// Cria ou atualiza um documento
export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const b = await req.json()
    const { ids } = await idsPermitidos(usuario)
    if (!ids.has(String(b.empresa_id || '').trim())) {
      return NextResponse.json({ sucesso: false, erro: 'Sem acesso a esta empresa.' }, { status: 403 })
    }
    if (!b.tipo_slug) return NextResponse.json({ sucesso: false, erro: 'Tipo de documento obrigatório.' })

    // Validade chega como aaaa-mm-dd e é gravada como dd/mm/aaaa (padrão da planilha)
    const validadeBR = b.validade
      ? (() => { const p = String(b.validade).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : b.validade })()
      : ''

    const campos = {
      validade: validadeBR,
      observacao: b.observacao || '',
      drive_file_id: b.drive_file_id || '',
      drive_file_url: b.drive_file_url || '',
    }

    if (b.id) {
      const r = await atualizarLinha('Documentos', 'id', b.id, campos)
      if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
      return NextResponse.json({ sucesso: true, id: b.id })
    }

    const id = novoId()
    const r = await adicionarLinha('Documentos', {
      id,
      empresa_id: b.empresa_id,
      tipo_slug: b.tipo_slug,
      ...campos,
      created_at: new Date().toLocaleString('pt-BR'),
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
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ sucesso: false, erro: 'ID obrigatório.' })

    // Garante que o documento pertence a uma empresa permitida
    const [{ ids }, documentos] = await Promise.all([idsPermitidos(usuario), lerAba('Documentos')])
    const doc = documentos.find(d => String(d.id || '').trim() === String(id).trim())
    if (!doc) return NextResponse.json({ sucesso: false, erro: 'Documento não encontrado.' })
    if (!ids.has(String(doc.empresa_id || '').trim())) {
      return NextResponse.json({ sucesso: false, erro: 'Sem permissão.' }, { status: 403 })
    }

    const r = await excluirLinha('Documentos', 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao excluir: ' + e.message }, { status: 500 })
  }
}
