import { NextResponse } from 'next/server'
import { getUsuarioFromReq } from '@/lib/auth'

export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  return NextResponse.json({ sucesso: true, usuario })
}
