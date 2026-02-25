import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthSessionProvider } from '@/components/auth-session-provider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SILAB-KL | Poltekkes Kemenkes Surabaya',
  description: 'Sistem Informasi Laboratorium - Jurusan Kesehatan Lingkungan Poltekkes Kemenkes Surabaya',
}

export const viewport: Viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className={`${inter.className} font-sans antialiased`}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
