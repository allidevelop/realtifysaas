import { buyPackAction } from '@/app/(account)/billing-actions'
import { Icon } from '@/components/Icon'
import { formatPrice, formatThousands } from '@/lib/format'
import type { ServicePlan } from '@/payload-types'

// Карточка пакета с кнопкой покупки (форма → buyPackAction → провайдер оплаты).
// canBuyForOrg — показывать переключатель «купить на организацию» (для владельца org).
export function PackBuyCard({ pack, canBuyForOrg = false }: { pack: ServicePlan; canBuyForOrg?: boolean }) {
  const accessInfo =
    pack.accessType === 'period'
      ? `${pack.periodDays ?? 0} днів доступу`
      : `${pack.quota ?? 0} запитів`

  return (
    <div className="flex flex-col rounded-2xl border border-ink-100 bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink-900">{pack.name}</h3>
        {pack.highlighted && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            Популярний
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-500">{accessInfo}</p>

      <div className="mt-4 flex items-baseline gap-1.5 text-ink-900">
        {pack.currency === 'UAH' ? (
          <>
            <span className="text-3xl font-bold">{formatThousands(pack.price).value}</span>
            <span className="text-sm text-ink-500">{formatThousands(pack.price).unit}</span>
          </>
        ) : (
          <span className="text-3xl font-bold">{formatPrice(pack.price, pack.currency)}</span>
        )}
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-ink-700">
        {(pack.features ?? []).map((f) => (
          <li key={f.id ?? f.label} className="flex items-start gap-2">
            <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      <form action={buyPackAction} className="mt-6">
        <input type="hidden" name="packId" value={pack.id} />
        <input type="hidden" name="paymentMethod" value="card" />
        {canBuyForOrg && (
          <label className="mb-3 flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" name="forOrg" className="h-4 w-4 rounded border-ink-300" />
            Купити для організації (спільний доступ)
          </label>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {pack.ctaLabel ?? 'Купити'}
        </button>
      </form>
    </div>
  )
}
