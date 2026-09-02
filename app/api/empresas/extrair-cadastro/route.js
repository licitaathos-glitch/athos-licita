import { NextResponse } from 'next/server'
import { lerAba, atualizarLinha, garantirAba } from '@/lib/google'
import { getUsuarioFromReq, ehAdmin } from '@/lib/auth'
import { chamarGAS } from '@/lib/gas'
import { COLS_EMPRESA } from '../route'

export const maxDuration = 60

// Extrai dados cadastrais (razão social, endereço, representante legal etc.)
// a partir dos PDFs de certidões já anexados no Drive da empresa, usando o
// mesmo Gemini que já lê editais — só que essa leitura roda dentro do Apps
// Script (Code.gs), porque é lá que a chave do Gemini e o acesso ao Drive já
// estão configurados juntos. Esta rota só aciona e grava o resultado no Sheets.
export async function POST(req) {
  const usuario = await getUsuarioFromReq(req)
  if (!usuario) return NextResponse.json({ sucesso: false, erro: 'Não autenticado.' }, { status: 401 })
  if (!ehAdmin(usuario)) return NextResponse.json({ sucesso: false, erro: 'Apenas administradores.' }, { status: 403 })

  try {
    const { empresaId, sobrescrever } = await req.json()
    if (!empresaId) return NextResponse.json({ sucesso: false, erro: 'Empresa obrigatória.' })

    await garantirAba('Empresas', COLS_EMPRESA)
    const [documentos, empresas] = await Promise.all([lerAba('Documentos'), lerAba('Empresas')])
    const empresaAtual = empresas.find(e => String(e.id).trim() === String(empresaId).trim())
    if (!empresaAtual) return NextResponse.json({ sucesso: false, erro: 'Empresa não encontrada.' })

    // Os dados cadastrais estão nos documentos societários, não em qualquer
    // certidão. Manda só os que valem a pena, no máximo três — cada PDF a mais
    // é mais tempo no Gemini, e o Apps Script tem limite de execução.
    const PRIORIDADE = ['contrato_social', 'cartao_cnpj', 'cert_simpl', 'insc_est', 'insc_mun', 'alvara_func']
    const arquivos = documentos
      .filter(d => String(d.empresa_id || '').trim() === String(empresaId).trim() && d.drive_file_id)
      .map(d => ({ driveFileId: d.drive_file_id, tipo: d.tipo_slug }))
      .sort((a, b) => {
        const pa = PRIORIDADE.indexOf(a.tipo); const pb = PRIORIDADE.indexOf(b.tipo)
        return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
      })
      .slice(0, 3)

    if (!arquivos.length) {
      return NextResponse.json({ sucesso: false, erro: 'Esta empresa não tem nenhuma certidão anexada no Drive ainda.' })
    }

    // O Apps Script baixa cada arquivo do Drive, manda pro Gemini e devolve
    // só os campos que conseguiu identificar — nunca escreve na planilha
    // diretamente, pra manter lib/google.js como único ponto de escrita.
    const r = await chamarGAS({ action: 'extrairCadastroEmpresa', arquivos })
    if (!r || !r.sucesso) {
      return NextResponse.json({ sucesso: false, erro: (r && r.erro) || 'Não foi possível extrair os dados agora.' })
    }

    const extraidos = r.campos || {}
    const campos = {}
    const preenchidos = []
    const ignorados = []

    COLS_EMPRESA.forEach(c => {
      if (c === 'id' || extraidos[c] === undefined || !String(extraidos[c] || '').trim()) return
      const jaTinha = String(empresaAtual[c] || '').trim()
      if (jaTinha && !sobrescrever) { ignorados.push(c); return }
      campos[c] = extraidos[c]
      preenchidos.push(c)
    })

    if (!preenchidos.length) {
      return NextResponse.json({
        sucesso: true, preenchidos: [], ignorados,
        aviso: 'A IA não encontrou campos novos para preencher (ou os campos já estavam preenchidos — use "sobrescrever" para forçar).',
      })
    }

    const grav = await atualizarLinha('Empresas', 'id', empresaId, campos)
    if (!grav.ok) return NextResponse.json({ sucesso: false, erro: grav.erro })

    return NextResponse.json({ sucesso: true, preenchidos, ignorados })
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: 'Erro no servidor: ' + e.message }, { status: 500 })
  }
}
