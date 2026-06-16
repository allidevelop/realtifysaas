import crypto from 'crypto'

import { DataBadge } from '@/components/account/DataBadge'
import { Paywall } from '@/components/account/Paywall'
import { Icon } from '@/components/Icon'
import { UnitCombobox } from '@/components/valuation/UnitCombobox'
import { requireUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'
import { MODULE_META } from '@/lib/billing/modules'
import { getAdminUnitOptions } from '@/lib/geo/engine'

export const dynamic = 'force-dynamic'

type SP = { searchParams: Promise<{ error?: string }> }

export default async function ReportGeneratorPage({ searchParams }: SP) {
  const meta = MODULE_META['report-generator']
  const user = await requireUser('/account/report-generator')
  const access = await resolveModuleAccess(user, 'report-generator')
  const sp = await searchParams

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name={meta.icon} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{meta.title}</h1>
          <p className="text-sm text-ink-500">{meta.summary}</p>
          <div className="mt-1.5">
            <DataBadge kind="demo" note="агреговані демо-показники" />
          </div>
        </div>
      </div>

      {access.allowed ? (
        // Уровень областей (level 1): отчёт даёт разрез по подчинённым районам.
        <Form quota={access.quotaRemaining ?? 0} units={await getAdminUnitOptions(1)} error={sp.error} />
      ) : (
        <Paywall moduleKey="report-generator" reason={access.reason} />
      )}
    </div>
  )
}

function Form({
  quota,
  units,
  error,
}: {
  quota: number
  units: { id: number; name: string; parentName: string | null }[]
  error?: string
}) {
  const runId = crypto.randomUUID()

  return (
    <form
      action="/account/report-generator/generate"
      method="POST"
      className="space-y-3 rounded-2xl border border-ink-100 bg-white p-6"
    >
      <input type="hidden" name="runId" value={runId} />
      {error && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {error === 'quota'
            ? 'Квоту вичерпано — придбайте пакет.'
            : 'Оберіть територіальну одиницю.'}
        </p>
      )}
      <p className="rounded-lg bg-ink-100/40 px-3 py-2 text-xs text-ink-600">
        Статистичний звіт середніх цін: динаміка по місяцях і кварталах (грн і USD за м²) +
        розріз по підпорядкованих районах. PDF на друк/експорт.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-700">Область</span>
        <UnitCombobox units={units} name="adminUnitId" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Сегмент</span>
          <select name="segment" className="geo-select" defaultValue="apartment">
            <option value="apartment">Вторинний ринок квартир</option>
            <option value="house">Будинки / домоволодіння</option>
            <option value="commercial">Комерційна нерухомість</option>
            <option value="land">Земельні ділянки</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Операція</span>
          <select name="operation" className="geo-select" defaultValue="sale">
            <option value="sale">Продаж</option>
            <option value="rent">Оренда</option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Згенерувати статистичний звіт (PDF, −1 запит)
      </button>
      <p className="text-center text-xs text-ink-500">Залишок квоти: {quota}</p>
    </form>
  )
}
