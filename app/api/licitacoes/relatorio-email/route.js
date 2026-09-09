import { NextResponse } from 'next/server'
import { lerAba } from '@/lib/google'
import { getUsuarioFromReq, podeAcessarMenu, empresasVisiveis } from '@/lib/auth'
import { chamarGAS } from '@/lib/gas'
import { calcularRelatorio, MESES } from '@/lib/relatorio'
import { montarEmailRelatorio } from '@/lib/relatorioEmail'

// Busca as licitações, empenhos e cotações do jeito que a própria tela do
// relatório busca — chamando as mesmas APIs internamente (com o cookie de
// sessão repassado), pra nunca duplicar as regras de acesso e filtro que já
// existem em cada uma delas.
async function buscarDados(req, empresaId) {
  const origem = new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''
  const headers = { cookie }

  const [l, e, c] = await Promise.all([
    fetch(`${origem}/api/licitacoes`, { headers }).then(r => r.json()),
    fetch(`${origem}/api/empenhos`, { headers }).then(r => r.json()).catch(() => null),
    fetch(`${origem}/api/licitacoes/cotacao?empresaId=${empresaId}`, { headers }).then(r => r.json()).catch(() => null),
  ])
  if (!l.sucesso) throw new Error(l.erro || 'Erro ao carregar licitações.')
  return {
    lics: l.licitacoes,
    empenhos: e && e.sucesso ? e.empenhos : [],
    cotacoes: c && c.sucesso ? c.cotacoes : [],
  }
}

export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!podeAcessarMenu(usuario, 'relatorio')) return NextResponse.json({ sucesso: false, erro: 'Seu usuário não tem acesso a este módulo.' }, { status: 403 })

  const { empresaId, mes, destinatarioEmail } = await req.json()
  if (!empresaId || !mes || !destinatarioEmail) return NextResponse.json({ sucesso: false, erro: 'Faltam dados.' })
  if (!destinatarioEmail.includes('@')) return NextResponse.json({ sucesso: false, erro: 'E-mail do destinatário inválido.' })

  try {
    const todas = await lerAba('Empresas')
    const empresa = empresasVisiveis(usuario, todas.filter(x => x.id)).find(x => String(x.id) === String(empresaId))
    if (!empresa) return NextResponse.json({ sucesso: false, erro: 'Empresa não encontrada ou sem acesso.' })

    const { lics, empenhos, cotacoes } = await buscarDados(req, empresaId)
    const rel = calcularRelatorio({ lics, empenhos, cotacoes, empresaSel: String(empresaId), mes })

    const [ano, mm] = mes.split('-')
    const rotuloMes = `${MESES[Number(mm) - 1]} de ${ano}`

    const html = montarEmailRelatorio({ empresaNome: empresa.nome, rotuloMes, rel })

    const env = await chamarGAS({
      action: 'enviarEmailGenerico', para: destinatarioEmail,
      assunto: `Relatório mensal — ${rotuloMes} — ${empresa.nome}`,
      htmlBody: html,
    }, 60)
    if (!env || env.sucesso === false || env.erro) {
      return NextResponse.json({ sucesso: false, erro: (env && env.erro) || 'Não foi possível enviar o e-mail.' })
    }

    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 })
  }
}
