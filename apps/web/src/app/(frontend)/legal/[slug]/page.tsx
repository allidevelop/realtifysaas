import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RenderBlocks } from '@/components/blocks/RenderBlocks'
import { Container } from '@/components/Container'
import { getPageBySlug, getPublishedPages } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

export async function generateStaticParams() {
  const pages = await getPublishedPages('legal')
  return pages.map((p) => ({ slug: p.slug }))
}

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  if (!page || page.section !== 'legal') return {}
  return buildMetadata({
    title: page.meta?.title ?? page.title,
    description: page.meta?.description ?? null,
    path: `/legal/${slug}`,
  })
}

export default async function LegalPage({ params }: Params) {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  if (!page || page.section !== 'legal') notFound()

  return (
    <article>
      <Container className="pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">{page.title}</h1>
      </Container>
      <RenderBlocks blocks={page.layout} />
    </article>
  )
}
