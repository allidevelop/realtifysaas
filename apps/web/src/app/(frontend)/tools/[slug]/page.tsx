import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { Section } from '@/components/Section'
import { ButtonLink } from '@/components/ui/Button'
import { getToolBySlug, getTools } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

export async function generateStaticParams() {
  const tools = await getTools()
  return tools.map((t) => ({ slug: t.slug }))
}

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const tool = await getToolBySlug(slug)
  if (!tool) return {}
  return buildMetadata({
    title: tool.meta?.title ?? tool.title,
    description: tool.meta?.description ?? tool.summary,
    path: `/tools/${slug}`,
  })
}

export default async function ToolPage({ params }: Params) {
  const { slug } = await params
  const tool = await getToolBySlug(slug)
  if (!tool) notFound()

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-ink-900">{tool.title}</h1>
        <p className="mt-4 text-lg text-ink-500">{tool.summary}</p>
        {tool.content && <RichText data={tool.content} className="mt-8" />}
        <div className="mt-10">
          <ButtonLink href="/pricing">Получить доступ</ButtonLink>
        </div>
      </div>
    </Section>
  )
}
