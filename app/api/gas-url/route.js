import { NextResponse } from 'next/server'
import { getUsuarioFromReq, podeEditar } from '@/lib/auth'

const GAS_URL = process.env.GAS_URL ||
  'https://script.google.com/macros/s/AKfycbzNxs1SOrYbZ1amVbRrCqa-w43R1hdIT56sgRMmlgINO4ROukWnogWUEX9FsVnfDbfn/exec'

// Entrega o endereço do Apps Script apenas a usuários autenticados que podem editar.
// O navegador envia os arquivos direto para lá, sem passar pela Vercel — assim
// não existe o limite de ~4,5 MB por requisição.
export async function GET(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeEditar(usuario)) return NextResponse.json({ sucesso: false, erro: 'Seu perfil é somente consulta.' }, { status: 403 })
  return NextResponse.json({ sucesso: true, url: GAS_URL })
}
