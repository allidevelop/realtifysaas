import type { FeatureGridBlock as FeatureGridBlockType } from '@/payload-types'

import { Icon, type IconName } from '@/components/Icon'
import { Section, SectionHeading } from '@/components/Section'

export function FeatureGridBlock({ heading, intro, features }: FeatureGridBlockType) {
  if (!features || features.length === 0) return null
  return (
    <Section muted>
      <SectionHeading title={heading} intro={intro} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.id ?? f.title}
            className="rounded-xl border border-ink-100 bg-surface p-6 shadow-sm"
          >
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Icon name={(f.icon ?? 'spark') as IconName} className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-ink-900">{f.title}</h3>
            {f.description && <p className="mt-2 text-sm text-ink-500">{f.description}</p>}
          </div>
        ))}
      </div>
    </Section>
  )
}
