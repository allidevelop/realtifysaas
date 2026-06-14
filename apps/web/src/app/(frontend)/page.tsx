import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', lineHeight: 1.6 }}>
      <h1>Realtify</h1>
      <p>Геоаналитическая платформа рынка недвижимости. Каркас (Этап 0).</p>
      <p>
        Админка контента: <Link href="/admin">/admin</Link>
      </p>
    </main>
  )
}
