import { DataBadge } from '@/components/account/DataBadge'
import { Paywall } from '@/components/account/Paywall'
import { ListingsSearch } from '@/components/analytics/ListingsSearch'
import { Icon } from '@/components/Icon'
import { requireUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'
import { MODULE_META } from '@/lib/billing/modules'
import { getAdminUnitOptions } from '@/lib/geo/engine'

export const dynamic = 'force-dynamic'

export default async function ArmAnalyticsPage() {
  const meta = MODULE_META['arm-analytics']
  const user = await requireUser('/account/arm-analytics')
  const access = await resolveModuleAccess(user, 'arm-analytics')

  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name={meta.icon} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{meta.title}</h1>
          <p className="text-sm text-ink-500">{meta.summary}</p>
          <div className="mt-1.5">
            <DataBadge kind="real" source="DOM.RIA / Prozorro" note="«усі джерела» додає демо" />
          </div>
        </div>
      </div>

      {access.allowed ? (
        <ListingsSearch units={await getAdminUnitOptions(2)} quota={access.quotaRemaining ?? 0} />
      ) : (
        <Paywall moduleKey="arm-analytics" reason={access.reason} />
      )}
    </div>
  )
}
