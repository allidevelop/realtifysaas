import { DataBadge } from '@/components/account/DataBadge'
import { Paywall } from '@/components/account/Paywall'
import { Icon } from '@/components/Icon'
import { AutoValuationModule } from '@/components/valuation/AutoValuationModule'
import { LibraryImport } from '@/components/valuation/LibraryImport'
import { requireUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'
import { MODULE_META } from '@/lib/billing/modules'

export const dynamic = 'force-dynamic'

export default async function AutoValuationPage() {
  const meta = MODULE_META['auto-valuation']
  const user = await requireUser('/account/auto-valuation')
  const access = await resolveModuleAccess(user, 'auto-valuation')

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
            <DataBadge kind="real" source="ваш PDF + реальні аналоги" note="OCR + підбір з оголошень" />
          </div>
        </div>
      </div>

      {access.allowed ? (
        <>
          <AutoValuationModule quota={access.quotaRemaining ?? 0} />
          <LibraryImport />
        </>
      ) : (
        <Paywall moduleKey="auto-valuation" reason={access.reason} />
      )}
    </div>
  )
}
