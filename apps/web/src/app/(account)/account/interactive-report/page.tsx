import { DataBadge } from '@/components/account/DataBadge'
import { Paywall } from '@/components/account/Paywall'
import { Dashboard } from '@/components/analytics/Dashboard'
import { Icon } from '@/components/Icon'
import { requireUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'
import { MODULE_META } from '@/lib/billing/modules'
import { formatDate } from '@/lib/format'
import { getAdminUnitOptions } from '@/lib/geo/engine'

export const dynamic = 'force-dynamic'

export default async function InteractiveReportPage() {
  const meta = MODULE_META['interactive-report']
  const user = await requireUser('/account/interactive-report')
  const access = await resolveModuleAccess(user, 'interactive-report')

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-2 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name={meta.icon} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{meta.title}</h1>
          <p className="text-sm text-ink-500">{meta.summary}</p>
          <div className="mt-1.5">
            <DataBadge kind="demo" note="показники ринку — моделювання, не реальні угоди" />
          </div>
        </div>
      </div>

      {access.allowed ? (
        <>
          {access.periodEnd && (
            <p className="text-xs text-ink-500">Доступ активний до {formatDate(access.periodEnd)}</p>
          )}
          <Dashboard units={await getAdminUnitOptions(2)} />
        </>
      ) : (
        <Paywall moduleKey="interactive-report" reason={access.reason} />
      )}
    </div>
  )
}
