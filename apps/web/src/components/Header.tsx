import Link from 'next/link'

import { Container } from '@/components/Container'
import { ButtonLink } from '@/components/ui/Button'
import { getSiteSettings } from '@/lib/queries'

// Шапка сайта (ТЗ §8). Навигация из SiteSettings; есть дефолт на случай пустой CMS.
const FALLBACK_NAV = [
  { label: 'Инструменты', href: '/tools' },
  { label: 'Тарифы', href: '/pricing' },
  { label: 'Новости', href: '/news' },
  { label: 'О нас', href: '/about' },
  { label: 'Контакты', href: '/contacts' },
]

export async function Header() {
  const settings = await getSiteSettings()
  const nav =
    settings?.headerNav && settings.headerNav.length > 0
      ? settings.headerNav.map((i) => ({ label: i.label, href: i.href }))
      : FALLBACK_NAV

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-white">
            R
          </span>
          {settings?.siteName ?? 'Realtify'}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-700 transition-colors hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/account/login"
            className="hidden text-sm font-medium text-ink-700 hover:text-brand-700 sm:inline"
          >
            Вход
          </Link>
          <ButtonLink href="/pricing" variant="primary" className="px-4 py-2">
            Начать
          </ButtonLink>
        </div>
      </Container>
    </header>
  )
}
