import Link from 'next/link'

import { Container } from '@/components/Container'
import { getSiteSettings } from '@/lib/queries'

const FALLBACK_FOOTER = [
  { label: 'О системе', href: '/about' },
  { label: 'Тарифы', href: '/pricing' },
  { label: 'Новости', href: '/news' },
  { label: 'Контакты', href: '/contacts' },
  { label: 'Оферта', href: '/legal/oferta' },
  { label: 'Политика приватности', href: '/legal/privacy' },
]

export async function Footer() {
  const settings = await getSiteSettings()
  const nav =
    settings?.footerNav && settings.footerNav.length > 0
      ? settings.footerNav.map((i) => ({ label: i.label, href: i.href }))
      : FALLBACK_FOOTER
  const year = new Date().getFullYear()

  return (
    <footer className="mt-24 border-t border-ink-100 bg-ink-100/40">
      <Container className="grid gap-8 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-ink-900">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-white">
              R
            </span>
            {settings?.siteName ?? 'Realtify'}
          </div>
          <p className="mt-3 max-w-sm text-sm text-ink-500">
            {settings?.tagline ?? 'Геоаналитика рынка недвижимости Украины.'}
          </p>
        </div>

        <nav className="flex flex-col gap-2">
          <div className="mb-1 text-sm font-semibold text-ink-900">Навигация</div>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-500 transition-colors hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2 text-sm text-ink-500">
          <div className="mb-1 text-sm font-semibold text-ink-900">Контакты</div>
          {settings?.email && (
            <a href={`mailto:${settings.email}`} className="hover:text-brand-700">
              {settings.email}
            </a>
          )}
          {settings?.phone && <span>{settings.phone}</span>}
          {settings?.telegram && (
            <a href={settings.telegram} className="hover:text-brand-700">
              Telegram-бот
            </a>
          )}
        </div>
      </Container>

      <div className="border-t border-ink-100">
        <Container className="flex flex-col items-center justify-between gap-2 py-4 text-xs text-ink-500 sm:flex-row">
          <span>
            © {year} {settings?.siteName ?? 'Realtify'}. Все права защищены.
          </span>
          <span>Данные — из легитимных источников.</span>
        </Container>
      </div>
    </footer>
  )
}
