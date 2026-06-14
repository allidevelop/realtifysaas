import Link from 'next/link'

import type { PricingBlock as PricingBlockType } from '@/payload-types'

import { PlanCard } from '@/components/PlanCard'
import { Section, SectionHeading } from '@/components/Section'
import { getPacksGroupedByModule } from '@/lib/billing/catalog'

// На главной показываем по одному «топовому» пакету каждого модуля (тизер),
// полный список — на /pricing.
export async function PricingBlock({ heading, intro, note }: PricingBlockType) {
  const groups = await getPacksGroupedByModule()
  if (groups.length === 0) return null

  const teaser = groups
    .map((g) => g.packs.find((p) => p.highlighted) ?? g.packs[0])
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  return (
    <Section muted>
      <SectionHeading title={heading} intro={intro} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {teaser.map((pack) => (
          <PlanCard key={pack.id} plan={pack} />
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/pricing" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Усі пакети та тарифи →
        </Link>
      </div>
      {note && <p className="mt-4 text-center text-sm text-ink-500">{note}</p>}
    </Section>
  )
}
