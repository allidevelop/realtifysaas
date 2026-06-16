import crypto from 'crypto'

import { notFound } from 'next/navigation'

import { Paywall } from '@/components/account/Paywall'
import { Icon } from '@/components/Icon'
import { requireUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'
import { isModuleKey, MODULE_META } from '@/lib/billing/modules'
import { formatDate, quotaLabel } from '@/lib/format'

import { runModuleAction } from '@/app/(account)/billing-actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ module: string }>
  searchParams: Promise<{ ran?: string; remaining?: string; error?: string }>
}

export default async function ModulePage({ params, searchParams }: Props) {
  const { module } = await params
  if (!isModuleKey(module)) notFound()

  const meta = MODULE_META[module]
  const user = await requireUser(`/account/${module}`)
  const access = await resolveModuleAccess(user, module)
  const sp = await searchParams

  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name={meta.icon} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{meta.title}</h1>
          <p className="text-sm text-ink-500">{meta.summary}</p>
        </div>
      </div>

      {/* Сообщение о результате запуска */}
      {sp.ran && (
        <p className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Розрахунок виконано. Залишок квоти: <b>{sp.remaining === 'Infinity' ? '∞' : sp.remaining}</b>.
        </p>
      )}
      {sp.error && (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {sp.error === 'quota-exhausted'
            ? 'Квоту вичерпано — придбайте пакет нижче.'
            : 'Дію не виконано.'}
        </p>
      )}

      {access.allowed ? (
        <AllowedView moduleKey={module} access={access} />
      ) : (
        <Paywall moduleKey={module} reason={access.reason} />
      )}
    </div>
  )
}

async function AllowedView({
  moduleKey,
  access,
}: {
  moduleKey: string
  access: Awaited<ReturnType<typeof resolveModuleAccess>>
}) {
  const runId = crypto.randomUUID()

  return (
    <section className="mt-8 rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
      {access.accessType === 'free' && (
        <p className="text-ink-700">
          Модуль доступний безкоштовно. Інтерактивна частина (карта/дані) — на наступному етапі.
        </p>
      )}

      {access.accessType === 'period' && (
        <p className="text-ink-700">
          Доступ активний до <b>{formatDate(access.periodEnd)}</b>. Інтерактивна частина — на
          наступному етапі.
        </p>
      )}

      {access.accessType === 'quota' && (
        <div>
          <p className="text-ink-700">
            Залишок квоти: <b>{quotaLabel(access.quotaRemaining)}</b> запитів. Кожен запуск списує 1.
          </p>
          <form action={runModuleAction} className="mt-6">
            <input type="hidden" name="module" value={moduleKey} />
            <input type="hidden" name="runId" value={runId} />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Виконати розрахунок (−1)
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
