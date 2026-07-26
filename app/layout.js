import './globals.css'

export const metadata = {
  title: 'Athos Licita',
  description: 'Plataforma integrada de gestão de licitações',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
