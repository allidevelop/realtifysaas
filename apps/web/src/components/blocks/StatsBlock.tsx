import type { StatsBlock as StatsBlockType } from '@/payload-types'

import { Section, SectionHeading } from '@/components/Section'

export function StatsBlock({ heading, items }: StatsBlockType) {
  if (!items || items.length === 0) return null
  return (
    <Section>
      <SectionHeading title={heading} />
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id ?? item.label}
            className="rounded-xl border border-ink-100 bg-surface p-6 text-center shadow-sm"
          >
            <dt className="text-3xl font-bold text-brand-600">{item.value}</dt>
            <dd className="mt-1 text-sm text-ink-500">{item.label}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
