import { AnalogDatabase } from '@/components/valuation/AnalogDatabase'
import { Icon } from '@/components/Icon'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AnalogDatabasePage() {
  await requireUser('/account/analog-database')
  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name="report" className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">База аналогів</h1>
          <p className="text-sm text-ink-500">
            Перевірені аналоги за адресами/ЖК. Автооцінка бере їх із цієї бази перед пошуком.
            Редагуйте поля, додавайте та видаляйте аналоги.
          </p>
        </div>
      </div>
      <AnalogDatabase />
    </div>
  )
}
