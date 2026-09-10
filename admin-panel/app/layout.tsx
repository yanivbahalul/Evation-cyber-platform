import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EVATION — Blue Team Operations',
  description:
    'Blue Team operations workspace for real-time monitoring, investigation, and deception telemetry.',
}

export const viewport: Viewport = {
  themeColor: '#0a0d12',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background" style={{ colorScheme: 'dark' }}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
