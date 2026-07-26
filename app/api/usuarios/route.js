import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin } from '@/lib/auth'

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem ver os usuários.' }, { status: 403 })

  const usuarios = await lerAba('Usuarios')
  const lista = usuarios.filter(u => u.id).map(u => ({
    id: u.id, nome: u.nome, email: u.email, perfil: u.perfil,
    empresa_id: u.empresa_id || '', empresas_permitidas: u.empresas_permitidas || '',
    ativo: u.ativo,
  }))
  return NextResponse.json({ sucesso: true, usuarios: lista })
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores podem criar usuários.' }, { status: 403 })

  try {
    const { nome, email, perfil, empresa_id, empresas_permitidas } = await req.json()
    if (!nome || !email || !perfil) {
      return NextResponse.json({ sucesso: false, erro: 'Preencha nome, e-mail e perfil.' })
    }
    const perfisValidos = ['adm', 'analista', 'empresa']
    if (!perfisValidos.includes(String(perfil).toLowerCase())) {
      return NextResponse.json({ sucesso: false, erro: 'Perfil inválido.' })
    }

    const usuarios = await lerAba('Usuarios')
    const emailBusca = String(email).trim().toLowerCase()
    const jaExiste = usuarios.some(u => String(u.email || '').trim().toLowerCase() === emailBusca)
    if (jaExiste) return NextResponse.json({ sucesso: false, erro: 'Já existe um usuário com esse e-mail.' })

    const proximoId = String(usuarios.reduce((max, u) => Math.max(max, parseInt(u.id) || 0), 0) + 1)
    const pin = String(Math.floor(100000 + Math.random() * 900000))

    const r = await adicionarLinha('Usuarios', {
      id: proximoId, nome, email, pin, perfil,
      empresa_id: perfil === 'empresa' ? (empresa_id || '') : '',
      empresas_permitidas: perfil === 'analista' ? (empresas_permitidas || '') : '',
      ativo: 'true',
    })
    if (!r.ok) return NextResponse.json({ sucesso: false, erro: r.erro })
    return NextResponse.json({ sucesso: true, id: proximoId, pin })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}
