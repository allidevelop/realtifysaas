import { Icon } from '@/components/Icon'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { billingPeriodLabel, formatPrice, formatThousands } from '@/lib/format'
import type { ServicePlan } from '@/payload-types'

export function PlanCard({ plan }: { plan: ServicePlan }) {
  const highlighted = Boolean(plan.highlighted)
  const t = formatThousands(plan.price)
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border bg-surface p-7 shadow-sm',
        highlighted ? 'border-brand-500 ring-1 ring-brand-500' : 'border-ink-100',
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink-900">{plan.name}</h3>
        {highlighted && (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
            Популярный
          </span>
        )}
      </div>
      {plan.tagline && <p className="mt-1 text-sm text-ink-500">{plan.tagline}</p>}

      <div className="mt-5 flex items-baseline gap-1.5">
        {plan.currency === 'UAH' ? (
          <>
            <span className="text-4xl font-bold text-ink-900">{t.value}</span>
            <span className="text-base text-ink-500">{t.unit}</span>
          </>
        ) : (
          <span className="text-4xl font-bold text-ink-900">
            {plan.price === 0 ? 'Безкоштовно' : formatPrice(plan.price, plan.currency)}
          </span>
        )}
        {plan.price > 0 && plan.billingPeriod && (
          <span className="text-sm text-ink-500">{billingPeriodLabel(plan.billingPeriod)}</span>
        )}
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-ink-700">
        {(plan.features ?? []).map((f) => (
          <li key={f.id ?? f.label} className="flex items-start gap-2">
            <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      <ButtonLink
        href={`/account/billing?plan=${plan.id}`}
        variant={highlighted ? 'primary' : 'secondary'}
        className="mt-7 w-full"
      >
        {plan.ctaLabel ?? 'Выбрать'}
      </ButtonLink>
    </div>
  )
}
