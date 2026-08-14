'use client'

// Links do Google Drive vêm no formato .../file/d/{id}/view. A partir do id dá
// para montar a versão embutida (preview) e a de download direto.
export function idDoDrive(url) {
  const s = String(url || '')
  return (s.match(/\/d\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || [])[1] || ''
}

export const urlPreview = url => {
  const id = idDoDrive(url)
  return id ? `https://drive.google.com/file/d/${id}/preview` : ''
}

export const urlDownload = url => {
  const id = idDoDrive(url)
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url
}

/**
 * Janela para ver o arquivo sem sair da tela, com opção de baixar, abrir no
 * Drive e imprimir. O arquivo fica no Drive pessoal e é privado — quem não
 * estiver logado nessa conta do Google vê o aviso de acesso em vez do PDF.
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
          <a href={urlDownload(url)} target="_blank" rel="noreferrer" className="iBtn iBtn-up">⬇ Baixar</a>
          <a href={url} target="_blank" rel="noreferrer" className="iBtn">↗ Abrir no Drive</a>
          <span style={{ fontSize: 11, color: '#94A3B8', alignSelf: 'center' }}>
            Para imprimir, use o ícone de impressora do próprio visualizador
          </span>
        </div>

        {preview ? (
          <iframe src={preview} title={nome} style={{ flex: 1, minHeight: 460, width: '100%', border: 0 }} />
        ) : (
          <div className="modal-body">
            <p style={{ fontSize: 13, color: '#64748B' }}>
              Este arquivo não está no Google Drive, então não dá para exibir aqui.
            </p>
            <a href={url} target="_blank" rel="noreferrer" className="iBtn">↗ Abrir arquivo</a>
          </div>
        )}
      </div>
    </div>
  )
}
