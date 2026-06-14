import type { PricingBlock as PricingBlockType } from '@/payload-types'

import { PlanCard } from '@/components/PlanCard'
import { Section, SectionHeading } from '@/components/Section'
import { getServicePlans } from '@/lib/queries'

export async function PricingBlock({ heading, intro, note }: PricingBlockType) {
  const plans = await getServicePlans()
  if (plans.length === 0) return null

  return (
    <Section muted>
      <SectionHeading title={heading} intro={intro} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
      {note && <p className="mt-8 text-center text-sm text-ink-500">{note}</p>}
    </Section>
  )
}
