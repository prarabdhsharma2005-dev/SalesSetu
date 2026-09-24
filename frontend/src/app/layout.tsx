import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SalesSetu — AI Sales Operating System',
  description: 'Bridge every sales opportunity from lead to deal. AI-powered prospecting, outreach, and pipeline management for modern sales teams.',
  keywords: 'AI sales, lead generation, sales automation, CRM, outreach, pipeline management',
  openGraph: {
    title: 'SalesSetu — AI Sales Operating System',
    description: 'Bridge every sales opportunity from lead to deal.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
