import { Paywall } from '@/components/account/Paywall'
import { Icon } from '@/components/Icon'
import { PortfolioModule } from '@/components/valuation/PortfolioModule'
import { requireUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'
import { MODULE_META } from '@/lib/billing/modules'
import { getAdminUnitOptions } from '@/lib/geo/engine'

export const dynamic = 'force-dynamic'

export default async function PortfolioValuationPage() {
  const meta = MODULE_META['portfolio-valuation']
  const user = await requireUser('/account/portfolio-valuation')
  const access = await resolveModuleAccess(user, 'portfolio-valuation')

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
        <PortfolioModule units={await getAdminUnitOptions(2)} quota={access.quotaRemaining ?? 0} />
      ) : (
        <Paywall moduleKey="portfolio-valuation" reason={access.reason} />
      )}
    </div>
  )
}
