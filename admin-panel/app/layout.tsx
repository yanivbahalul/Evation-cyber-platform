import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HoneyShield — Active Cyber Deception Platform',
  description:
    'HoneyShield analyst console for deception telemetry, attacker investigation, and response.',
}

export const viewport: Viewport = {
  themeColor: '#f6f8fb',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background" style={{ colorScheme: 'light' }}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
