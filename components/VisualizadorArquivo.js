'use client'

// Links do Google Drive vêm no formato .../file/d/{id}/view. A partir do id dá
// para montar a versão embutida (preview) e a de download direto.
export function idDoDrive(url) {
  const s = String(url || '')
  return (s.match(/\/d\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || [])[1] || ''
}

// Passa pelo próprio sistema em vez do Drive: os arquivos são privados, então
// o preview do Google só funcionava para quem estivesse logado naquela conta
// Google. Pelo /api/arquivo, quem autoriza é o login do Athos Licita.
export const urlPreview = url => '/api/arquivo?url=' + encodeURIComponent(url)
export const urlDownload = url => '/api/arquivo?baixar=1&url=' + encodeURIComponent(url)

/**
 * Janela para ver o arquivo sem sair da tela, com opção de baixar e imprimir.
 * O arquivo vem pelo /api/arquivo, que só responde a quem está logado.
 */
export default function VisualizadorArquivo({ url, nome = 'Arquivo', onFechar }) {
  const preview = urlPreview(url)

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="modal modal-lg" style={{ display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
        <div className="modal-hdr">
          <div style={{ minWidth: 0 }}>
            <div className="modal-hdr-sub">ARQUIVO</div>
            <div className="modal-hdr-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nome}
            </div>
          </div>
          <button className="modal-x" onClick={onFechar}>×</button>
        </div>

        <div style={{ padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
          <a href={urlDownload(url)} className="iBtn iBtn-up">⬇ Baixar</a>
          <a href={urlPreview(url)} target="_blank" rel="noreferrer" className="iBtn">↗ Abrir em nova aba</a>
          <span style={{ fontSize: 11, color: '#94A3B8', alignSelf: 'center' }}>
            Para imprimir, use o ícone de impressora do visualizador
          </span>
        </div>

        <iframe src={preview} title={nome} style={{ flex: 1, minHeight: 460, width: '100%', border: 0 }} />
      </div>
    </div>
  )
}
