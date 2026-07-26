import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { lerToken } from '@/lib/session'

export default async function Home() {
  const token = cookies().get('athos_sessao')?.value
  const usuario = token ? await lerToken(token) : null
  redirect(usuario ? '/dashboard' : '/login')
}
