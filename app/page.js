import Link from 'next/link'

export const metadata = {
  title: 'Athos Licita — Gestão inteligente de licitações',
  description: 'Certidões, editais e atas de registro de preços em um só lugar. Lei 14.133/2021.',
}

export default function Home() {
  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-brand"><span className="lp-ico">⚡</span> Athos Licita</div>
        <Link href="/login" className="lp-btn-outline">Entrar</Link>
      </header>

      <section className="lp-hero">
        <span className="lp-badge">Lei nº 14.133/2021</span>
        <h1>Gestão inteligente de <em>licitações públicas</em></h1>
        <p>
          Certidões, editais, checklists de viabilidade e atas de registro de preços —
          tudo organizado, com alertas automáticos e inteligência artificial,
          para sua empresa nunca perder um prazo.
        </p>
        <Link href="/login" className="lp-cta">Acessar a plataforma →</Link>
      </section>

      <section className="lp-features">
        <div className="lp-card">
          <div className="lp-card-ico">📋</div>
          <h3>Certidões sob controle</h3>
          <p>Upload do PDF e pronto: a IA lê a validade sozinha. Alertas antes do vencimento, por empresa.</p>
        </div>
        <div className="lp-card">
          <div className="lp-card-ico">⚡</div>
          <h3>Licitações sem digitação</h3>
          <p>Cole o link do PNCP e os dados do edital são extraídos automaticamente — objeto, valores, datas e itens.</p>
        </div>
        <div className="lp-card">
          <div className="lp-card-ico">✅</div>
          <h3>Checklist de viabilidade</h3>
          <p>Análise do edital ponto a ponto — qualificação, prazos, garantias — com apoio de IA para decidir: participar ou não.</p>
        </div>
        <div className="lp-card">
          <div className="lp-card-ico">📑</div>
          <h3>Gestão de Atas</h3>
          <p>Atas de registro de preços com itens, saldos empenhados e avisos de vencimento da vigência.</p>
        </div>
      </section>

      <section className="lp-pillars">
        <div className="lp-pillar">
          <strong>🤖 Inteligência artificial</strong>
          <span>Leitura automática de PDFs com Google Gemini</span>
        </div>
        <div className="lp-pillar">
          <strong>☁️ Seus dados, seu Drive</strong>
          <span>Documentos armazenados no Google Drive da sua conta</span>
        </div>
        <div className="lp-pillar">
          <strong>🔔 Alertas automáticos</strong>
          <span>Avisos por e-mail antes de cada vencimento</span>
        </div>
      </section>

      <footer className="lp-footer">
        © {new Date().getFullYear()} Athos Licita · Gestão de licitações — Lei nº 14.133/2021
      </footer>
    </div>
  )
}
