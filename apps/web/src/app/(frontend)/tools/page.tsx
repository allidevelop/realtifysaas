import type { Metadata } from 'next'

import { Section, SectionHeading } from '@/components/Section'
import { ToolCard } from '@/components/ToolCard'
import { getTools } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Инструменты',
    description: 'Геоаналитические инструменты платформы: карта цен, оценка, отчёты, API, бот.',
    path: '/tools',
  })
}

export default async function ToolsPage() {
  const tools = await getTools()
  return (
    <Section>
      <SectionHeading
        title="Инструменты"
        intro="Набор инструментов для анализа рынка и оценки недвижимости."
      />
      {tools.length === 0 ? (
        <p className="text-center text-ink-500">Инструменты ещё не добавлены в CMS.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </Section>
  )
}
