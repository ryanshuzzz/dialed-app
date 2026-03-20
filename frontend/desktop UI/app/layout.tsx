import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { DesktopSidebar } from '@/components/desktop-sidebar'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Dialed - Motorcycle Suspension Tuning',
  description: 'Professional motorcycle suspension tuning PWA for track riders. Log sessions, analyze telemetry, and get AI-powered setup recommendations.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dialed',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${ibmPlexSans.variable} ${jetbrainsMono.variable} font-sans antialiased lg:overflow-hidden`}>
        <DesktopSidebar />
        <div className="lg:pl-[220px] lg:h-screen lg:overflow-hidden">
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  )
}
