import { NextResponse } from 'next/server'
import { getUsuarioFromReq, normalizarPerfil, menusPermitidos, menusUnificados, mapaPorEmpresa } from '@/lib/auth'

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  // Devolve o perfil já normalizado para o frontend usar o mesmo critério do backend
  return NextResponse.json({
    sucesso: true,
    usuario: {
      ...usuario,
      perfil: normalizarPerfil(usuario),
      menus: menusPermitidos(usuario),
      menusUnificados: menusUnificados(usuario),
      menusPorEmpresa: Object.fromEntries(
        Object.entries(mapaPorEmpresa(usuario)).map(([id]) => [id, menusPermitidos(usuario, id)])
      ),
    },
  })
}
