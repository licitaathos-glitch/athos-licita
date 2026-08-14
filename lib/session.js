import { SignJWT, jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret')

// Sessão longa e renovada a cada visita: o app instalado no celular guarda o
// cookie num espaço próprio (separado do navegador) e uma sessão curta obrigava
// a logar de novo o tempo todo. Enquanto a pessoa usar, não expira.
export const DIAS_SESSAO = 90
export const SEGUNDOS_SESSAO = 60 * 60 * 24 * DIAS_SESSAO

export async function criarToken(usuario) {
  return new SignJWT({ u: usuario })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${DIAS_SESSAO}d`)
    .sign(secret())
}

export async function lerToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.u || null
  } catch {
    return null
  }
}
