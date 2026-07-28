import { NextResponse } from 'next/server'
import { lerAba, adicionarLinha, garantirAba } from '@/lib/google'
import { chamarGAS } from '@/lib/gas'
import { buscarPNCP } from '@/lib/pncp'
import { ABA_CRITERIOS, aplicarPerfil, listaDe } from '@/lib/perfilBusca'
import { certidoesEmAlerta, atasEmAlerta, sessoesAmanha, montarEmailDiario } from '@/lib/alertas'

export const maxDuration = 300 // até 5 min — dá tempo para consultar o PNCP empresa por empresa

const ABA_ENVIADAS = 'Alertas_Oportunidades_Enviadas'
const DESTINO_FIXO = 'licita.athos@gmail.com'

// Vercel Cron chama este endpoint às 08h (horário de Brasília) todo dia.
// Protegido por CRON_SECRET — configure essa env var na Vercel para ativar
// a proteção; sem ela, o endpoint responde 500 por segurança.
export async function GET(req) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return NextResponse.json({ sucesso: false, erro: 'CRON_SECRET não configurado no ambiente.' }, { status: 500 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  const resumo = []
  try {
    const [empresas, documentos, atas, licitacoes, criterios] = await Promise.all([
      lerAba('Empresas'), lerAba('Documentos'), lerAba('Atas'), lerAba('Licitacoes'), lerAba(ABA_CRITERIOS),
    ])
    await garantirAba(ABA_ENVIADAS, ['chave', 'empresaId', 'numeroPNCP', 'enviadoEm'])
    const jaEnviadas = new Set((await lerAba(ABA_ENVIADAS)).map(e => e.chave))

    const empresasPorId = Object.fromEntries(empresas.filter(e => e.id).map(e => [String(e.id).trim(), e.nome]))
    const perfilPorEmpresa = Object.fromEntries(criterios.map(c => [String(c.empresaId || '').trim(), c]))

    const certAlerta = certidoesEmAlerta(documentos, empresasPorId, 7)
    const ataAlerta = atasEmAlerta(atas, 30)
    const sessaoAlerta = sessoesAmanha(licitacoes)

    for (const empresa of empresas.filter(e => e.id)) {
      const id = String(empresa.id).trim()
      const certidoes = certAlerta.filter(c => c.empresaId === id)
      const atasVenc = ataAlerta.filter(a => a.empresaId === id)
      const sessoes = sessaoAlerta.filter(s => s.empresaId === id)

      // Busca de novas oportunidades — só roda se a empresa tiver um perfil configurado
      let oportunidades = []
      let erroOportunidades = null
      const perfil = perfilPorEmpresa[id]
      if (perfil && (listaDe(perfil.palavrasChave).length || listaDe(perfil.ufs).length)) {
        try {
          const r = await buscarPNCP({
            dias: 1,
            ufs: listaDe(perfil.ufs).length ? listaDe(perfil.ufs) : ['RJ'],
            modalidades: listaDe(perfil.modalidades).length ? listaDe(perfil.modalidades).map(Number) : [6, 8],
            termo: '', // o filtro fino é feito pelo aplicarPerfil, que também trata exclusões
          })
          if (!r.resultados.length && r.diagnostico.some(d => /HTTP|Erro/i.test(d))) {
            erroOportunidades = r.diagnostico[0]
          } else {
            const filtradas = aplicarPerfil(r.resultados, perfil)
            oportunidades = filtradas.filter(o => !jaEnviadas.has(id + '|' + o.numeroPNCP)).slice(0, 15)
          }
        } catch (e) {
          erroOportunidades = e.message
        }
      }

      const html = montarEmailDiario({
        empresaNome: empresa.nome, certidoes, atas: atasVenc, sessoes, oportunidades, erroOportunidades,
      })

      if (html) {
        const env = await chamarGAS({
          action: 'enviarEmailGenerico',
          para: DESTINO_FIXO,
          assunto: `Alerta diário — ${empresa.nome}`,
          htmlBody: html,
        })
        resumo.push({
          empresa: empresa.nome, enviado: !!(env && env.sucesso),
          certidoes: certidoes.length, atas: atasVenc.length, sessoes: sessoes.length, oportunidades: oportunidades.length,
        })
        // registra as oportunidades já avisadas, para não repetir amanhã
        for (const o of oportunidades) {
          await adicionarLinha(ABA_ENVIADAS, {
            chave: id + '|' + o.numeroPNCP, empresaId: id, numeroPNCP: o.numeroPNCP,
            enviadoEm: new Date().toISOString(),
          })
        }
      } else {
        resumo.push({ empresa: empresa.nome, enviado: false, motivo: 'nada a alertar hoje' })
      }
    }

    return NextResponse.json({ sucesso: true, resumo })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message, resumoParcial: resumo }, { status: 500 })
  }
}
