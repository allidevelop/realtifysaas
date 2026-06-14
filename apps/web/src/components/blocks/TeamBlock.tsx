import type { TeamBlock as TeamBlockType } from '@/payload-types'

import { Section, SectionHeading } from '@/components/Section'
import { getTeam } from '@/lib/queries'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export async function TeamBlock({ heading, intro }: TeamBlockType) {
  const team = await getTeam()
  if (team.length === 0) return null

  return (
    <Section>
      <SectionHeading title={heading} intro={intro} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {team.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-ink-100 bg-white p-6 text-center shadow-sm"
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-xl font-semibold text-brand-700">
              {initials(m.name)}
            </div>
            <h3 className="mt-4 font-semibold text-ink-900">{m.name}</h3>
            {m.role && <p className="text-sm text-ink-500">{m.role}</p>}
            {m.bio && <p className="mt-2 text-sm text-ink-500">{m.bio}</p>}
          </div>
        ))}
      </div>
    </Section>
  )
}
