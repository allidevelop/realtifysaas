import type { PartnersBlock as PartnersBlockType } from '@/payload-types'

import { Section, SectionHeading } from '@/components/Section'
import { getPartners } from '@/lib/queries'

export async function PartnersBlock({ heading }: PartnersBlockType) {
  const partners = await getPartners()
  if (partners.length === 0) return null

  return (
    <Section muted>
      <SectionHeading title={heading} />
      <div className="flex flex-wrap items-center justify-center gap-4">
        {partners.map((p) => {
          const chip = (
            <span className="rounded-lg border border-ink-100 bg-white px-5 py-3 text-sm font-medium text-ink-700 shadow-sm">
              {p.name}
            </span>
          )
          return p.url ? (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
              {chip}
            </a>
          ) : (
            <div key={p.id}>{chip}</div>
          )
        })}
      </div>
    </Section>
  )
}
