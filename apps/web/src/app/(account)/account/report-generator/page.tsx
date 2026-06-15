import crypto from 'crypto'

import { Paywall } from '@/components/account/Paywall'
import { Icon } from '@/components/Icon'
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
        </div>
      </div>

      {access.allowed ? (
        <Form
          quota={access.quotaRemaining ?? 0}
          units={await getAdminUnitOptions(2)}
          error={sp.error}
        />
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
  const grouped = new Map<string, typeof units>()
  for (const u of units) {
    const k = u.parentName ?? '—'
    if (!grouped.has(k)) grouped.set(k, [])
    grouped.get(k)!.push(u)
  }

  return (
    <form
      action="/account/report-generator/generate"
      method="POST"
      className="space-y-3 rounded-2xl border border-ink-100 bg-white p-6"
    >
      <input type="hidden" name="runId" value={runId} />
      {error && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {error === 'quota' ? 'Квоту вичерпано — придбайте пакет.' : 'Заповніть район і площу.'}
        </p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-700">Територіальна одиниця</span>
        <select name="adminUnitId" required className="geo-select">
          {[...grouped.entries()].map(([parent, list]) => (
            <optgroup key={parent} label={parent}>
              {list.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Сегмент</span>
          <select name="segment" className="geo-select" defaultValue="apartment">
            <option value="apartment">Квартира</option>
            <option value="house">Будинок</option>
            <option value="commercial">Комерція</option>
            <option value="land">Земля</option>
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
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Площа, м²</span>
          <input name="area" type="number" min={1} step="0.1" required defaultValue={65} className="geo-select" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Поверх</span>
          <input name="floor" type="number" min={1} className="geo-select" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Поверхів</span>
          <input name="totalFloors" type="number" min={1} className="geo-select" />
        </label>
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Згенерувати звіт (PDF, −1 запит)
      </button>
      <p className="text-center text-xs text-ink-500">Залишок квоти: {quota}</p>
    </form>
  )
}
