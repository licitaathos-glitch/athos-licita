import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, atualizarLinha, excluirLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin } from '@/lib/auth'
import { novoId } from '@/lib/uuid'
import { chamarGAS } from '@/lib/gas'

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem ver os usuários.' }, { status: 403 })

  const usuarios = await lerAba('Usuarios')
  const lista = usuarios.filter(u => u.id).map(u => ({
    id: u.id, nome: u.nome, email: u.email, perfil: u.perfil,
    empresa_id: u.empresa_id || '', empresas_permitidas: u.empresas_permitidas || '',
    menus: u.menus || '', ativo: u.ativo,
  }))
  return NextResponse.json({ sucesso: true, usuarios: lista })
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem criar usuários.' }, { status: 403 })

  try {
    const { nome, email, perfil, empresa_id, empresas_permitidas, menus } = await req.json()
    if (!nome || !email || !perfil) {
      return NextResponse.json({ sucesso: false, erro: 'Preencha nome, e-mail e perfil.' })
    }
    if (!['admin', 'analista', 'empresa'].includes(String(perfil).toLowerCase())) {
      return NextResponse.json({ sucesso: false, erro: 'Perfil inválido.' })
    }

    // Garante que a coluna "menus" existe na aba antes de gravar
    await garantirAba('Usuarios', ['id','nome','email','pin','perfil','ativo','criadoEm',
      'reset_token','reset_expira','empresa_id','empresas_permitidas','menus'])

    const usuarios = await lerAba('Usuarios')
    const emailBusca = String(email).trim().toLowerCase()
    if (usuarios.some(u => String(u.email || '').trim().toLowerCase() === emailBusca)) {
      return NextResponse.json({ sucesso: false, erro: 'Já existe um usuário com esse e-mail.' })
    }

    const pin = String(Math.floor(100000 + Math.random() * 900000))
    const id = novoId()

    const r = await adicionarLinha('Usuarios', {
      id, nome, email, pin, perfil,
      ativo: 'TRUE',
      criadoEm: new Date().toISOString(),
      empresa_id: perfil === 'empresa' ? (empresa_id || '') : '',
      empresas_permitidas: perfil === 'analista' ? (empresas_permitidas || '') : '',
      menus: Array.isArray(menus) ? menus.join(',') : (menus || ''),
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })

    // E-mail de boas-vindas com o PIN inicial (enviado pelo Apps Script via Gmail)
    let avisoEmail = null
    try {
      const env = await chamarGAS({ action: 'enviarBoasVindas', email, nome, pin, perfil })
      if (!env || env.sucesso === false) {
        avisoEmail = (env && (env.erro || env.mensagem)) || 'Não foi possível enviar o e-mail.'
      }
    } catch (e) {
      avisoEmail = 'Usuário criado, mas o e-mail não pôde ser enviado: ' + e.message
    }

    return NextResponse.json({ sucesso: true, id, pin, avisoEmail })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}

// Edita um usuário existente
export async function PUT(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem editar usuários.' }, { status: 403 })

  try {
    const { id, nome, perfil, empresa_id, empresas_permitidas, menus, ativo, redefinirPin } = await req.json()
    if (!id) return NextResponse.json({ sucesso: false, erro: 'ID obrigatório.' })

    const usuarios = await lerAba('Usuarios')
    const alvo = usuarios.find(u => String(u.id || '').trim() === String(id).trim())
    if (!alvo) return NextResponse.json({ sucesso: false, erro: 'Usuário não encontrado.' })

    const ehEuMesmo = String(alvo.email || '').trim().toLowerCase() === String(usuario.email || '').trim().toLowerCase()
    if (ehEuMesmo && ativo === false) {
      return NextResponse.json({ sucesso: false, erro: 'Você não pode desativar a própria conta.' })
    }
    if (ehEuMesmo && perfil && String(perfil).toLowerCase() !== 'admin') {
      return NextResponse.json({ sucesso: false, erro: 'Você não pode remover o próprio acesso de administrador.' })
    }

    const campos = {}
    if (nome !== undefined) campos.nome = nome
    if (perfil !== undefined) {
      if (!['admin', 'analista', 'empresa'].includes(String(perfil).toLowerCase())) {
        return NextResponse.json({ sucesso: false, erro: 'Perfil inválido.' })
      }
      campos.perfil = perfil
      campos.empresa_id = perfil === 'empresa' ? (empresa_id || '') : ''
      campos.empresas_permitidas = perfil === 'analista' ? (empresas_permitidas || '') : ''
    } else {
      if (empresa_id !== undefined) campos.empresa_id = empresa_id
      if (empresas_permitidas !== undefined) campos.empresas_permitidas = empresas_permitidas
    }
    if (ativo !== undefined) campos.ativo = ativo ? 'TRUE' : 'FALSE'

    let novoPin = null
    if (redefinirPin) {
      novoPin = String(Math.floor(100000 + Math.random() * 900000))
      campos.pin = novoPin
      campos.reset_token = ''
      campos.reset_expira = ''
    }

    if (menus !== undefined) {
      await garantirAba('Usuarios', ['id','nome','email','pin','perfil','ativo','criadoEm',
        'reset_token','reset_expira','empresa_id','empresas_permitidas','menus'])
      campos.menus = Array.isArray(menus) ? menus.join(',') : (menus || '')
    }

    const r = await atualizarLinha('Usuarios', 'id', id, campos)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })

    // Se o PIN foi redefinido, tenta avisar por e-mail
    let avisoEmail = null
    if (novoPin) {
      try {
        const env = await chamarGAS({
          action: 'enviarBoasVindas',
          email: alvo.email, nome: nome || alvo.nome, pin: novoPin, perfil: perfil || alvo.perfil,
        })
        if (!env || env.sucesso === false) avisoEmail = (env && env.erro) || 'E-mail não enviado.'
      } catch (e) { avisoEmail = e.message }
    }

    return NextResponse.json({ sucesso: true, novoPin, avisoEmail })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}

// Exclui um usuário
export async function DELETE(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem excluir usuários.' }, { status: 403 })

  try {
    const { id } = await req.json()
    const usuarios = await lerAba('Usuarios')
    const alvo = usuarios.find(u => String(u.id || '').trim() === String(id).trim())
    if (!alvo) return NextResponse.json({ sucesso: false, erro: 'Usuário não encontrado.' })
    if (String(alvo.email || '').trim().toLowerCase() === String(usuario.email || '').trim().toLowerCase()) {
      return NextResponse.json({ sucesso: false, erro: 'Você não pode excluir a própria conta.' })
    }
    const r = await excluirLinha('Usuarios', 'id', id)
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro ao excluir: ' + e.message }, { status: 500 })
  }
}
