import type { ToolsBlock as ToolsBlockType, Tool } from '@/payload-types'

import { Section, SectionHeading } from '@/components/Section'
import { ToolCard } from '@/components/ToolCard'
import { getTools } from '@/lib/queries'

export async function ToolsBlock({ heading, intro, tools }: ToolsBlockType) {
  // Если в блоке выбраны конкретные инструменты (depth>=1 → объекты) — берём их,
  // иначе показываем все активные.
  const selected = (tools ?? []).filter((t): t is Tool => typeof t === 'object' && t !== null)
  const list = selected.length > 0 ? selected : await getTools()
  if (list.length === 0) return null

  return (
    <Section>
      <SectionHeading title={heading} intro={intro} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </Section>
  )
}
