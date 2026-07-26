import { SignJWT, jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret')

export async function criarToken(usuario) {
  return new SignJWT({ u: usuario })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
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
