import React from 'react'

export const metadata = {
  title: 'Realtify — геоаналитика недвижимости',
  description: 'Коммерческая геоаналитическая платформа рынка недвижимости Украины.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  )
}
