import { Paywall } from '@/components/account/Paywall'
import { Icon } from '@/components/Icon'
import { ValuationModule } from '@/components/valuation/ValuationModule'
import { requireUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'
import { MODULE_META, type ModuleKey } from '@/lib/billing/modules'
import { getAdminUnitOptions } from '@/lib/geo/engine'

// Общая страница модуля оценки (express/detailed). Gated по квоте.
export async function ValuationPage({
  moduleKey,
  mode,
}: {
  moduleKey: ModuleKey
  mode: 'express' | 'detailed'
}) {
  const meta = MODULE_META[moduleKey]
  const user = await requireUser(`/account/${moduleKey}`)
  const access = await resolveModuleAccess(user, moduleKey)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name={meta.icon} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{meta.title}</h1>
          <p className="text-sm text-ink-500">{meta.summary}</p>
        </div>
      </div>

      {access.allowed ? (
        <ValuationModule
          moduleKey={moduleKey}
          mode={mode}
          units={await getAdminUnitOptions(2)}
          quotaRemaining={access.quotaRemaining ?? 0}
        />
      ) : (
        <Paywall moduleKey={moduleKey} reason={access.reason} />
      )}
    </div>
  )
}
