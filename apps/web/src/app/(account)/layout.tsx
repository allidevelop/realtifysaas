import type { Metadata } from 'next'
import React from 'react'

import { AccountNav } from '@/components/account/AccountNav'
import { getCurrentUser } from '@/lib/auth'
import { fontClass } from '@/lib/fonts'

import '../(frontend)/globals.css'

export const metadata: Metadata = {
  title: 'Кабінет — Realtify',
  robots: { index: false, follow: false },
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <html lang="uk" className={fontClass}>
      <body className="flex min-h-screen flex-col bg-paper text-ink-900 antialiased">
        <AccountNav user={user} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
