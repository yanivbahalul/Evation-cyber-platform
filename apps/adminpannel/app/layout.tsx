import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'InnoTech HoneyNet — Blue Team Dashboard',
  description:
    'Air-gapped admin dashboard for real-time monitoring of honeypot traps — Holon Institute of Technologies',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#070d10',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background" style={{ colorScheme: 'dark' }}>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
