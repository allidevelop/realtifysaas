import type { Metadata } from 'next'
import React from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { SITE_NAME, SITE_URL } from '@/lib/constants'

import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — геоаналитика рынка недвижимости`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    'Коммерческая геоаналитическая платформа рынка недвижимости Украины: карта цен, оценка, отчёты, API.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="flex min-h-screen flex-col bg-white text-ink-900 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
