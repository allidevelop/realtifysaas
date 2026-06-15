import { PackBuyCard } from '@/components/account/PackBuyCard'
import { getPacksForModule } from '@/lib/billing/catalog'
import { isModuleKey } from '@/lib/billing/modules'

// Paywall модуля: причина + пакеты для покупки (ТЗ §8.4).
export async function Paywall({ moduleKey, reason }: { moduleKey: string; reason?: string }) {
  const packs = isModuleKey(moduleKey) ? await getPacksForModule(moduleKey) : []

  return (
    <section className="mt-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Потрібен доступ</h2>
        <p className="mt-1 text-sm text-amber-800">
          {reason === 'quota-exhausted'
            ? 'Квоту вичерпано. Придбайте пакет, щоб продовжити.'
            : reason === 'period-expired'
              ? 'Період доступу завершено. Продовжіть, придбавши пакет.'
              : 'Цей модуль доступний за пакетом. Оберіть нижче.'}
        </p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((pack) => (
          <PackBuyCard key={pack.id} pack={pack} />
        ))}
      </div>
    </section>
  )
}
