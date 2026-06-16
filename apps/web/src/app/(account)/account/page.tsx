import Link from 'next/link'

import { Icon } from '@/components/Icon'
import { requireUser } from '@/lib/auth'
import { getModuleDashboard, type ModuleCard } from '@/lib/billing/cabinet'
import { formatDate, quotaLabel } from '@/lib/format'

export const dynamic = 'force-dynamic'

function statusBadge(card: ModuleCard) {
  const { access } = card
  if (access.accessType === 'free') {
    return { label: 'Доступно', cls: 'bg-green-50 text-green-700' }
  }
  if (access.allowed) {
    if (access.quotaRemaining === Number.POSITIVE_INFINITY) {
      return { label: 'Доступ: ∞', cls: 'bg-green-50 text-green-700' }
    }
    if (access.accessType === 'quota') {
      return { label: `Залишок: ${quotaLabel(access.quotaRemaining)}`, cls: 'bg-green-50 text-green-700' }
    }
    return { label: `Активно до ${formatDate(access.periodEnd)}`, cls: 'bg-green-50 text-green-700' }
  }
  if (access.reason === 'quota-exhausted') {
    return { label: 'Квоту вичерпано', cls: 'bg-amber-50 text-amber-700' }
  }
  if (access.reason === 'period-expired') {
    return { label: 'Період завершено', cls: 'bg-amber-50 text-amber-700' }
  }
  return { label: 'Заблоковано', cls: 'bg-ink-100 text-ink-500' }
}

export default async function DashboardPage() {
  const user = await requireUser('/account')
  const cards = await getModuleDashboard(user)

  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-ink-900">
        Особистий кабінет{user?.name ? ` — ${user.name}` : ''}
      </h1>
      <p className="mt-1 text-ink-500">
        Інтерактивні сервіси та продукти системи. Доступ — за вашими пакетами.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const badge = statusBadge(card)
          const open = card.access.allowed
          return (
            <div
              key={card.meta.key}
              className="group flex flex-col rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                  <Icon name={card.meta.icon} className="h-6 w-6" />
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-ink-900">{card.meta.title}</h2>
              <p className="mt-1 flex-1 text-sm text-ink-500">{card.meta.summary}</p>
              <Link
                href={`/account/${card.meta.key}`}
                className={`mt-5 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium ${
                  open
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-300/40'
                }`}
              >
                {open ? 'Відкрити' : 'Придбати доступ'}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
