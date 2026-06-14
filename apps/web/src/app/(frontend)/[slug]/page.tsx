import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RenderBlocks } from '@/components/blocks/RenderBlocks'
import { getPageBySlug, getPublishedPages } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

// Маршруты с собственными папками (news/tools/pricing) имеют приоритет над [slug].
export async function generateStaticParams() {
  const pages = await getPublishedPages('general')
  return pages.filter((p) => p.slug !== 'home').map((p) => ({ slug: p.slug }))
}

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  if (!page || page.section === 'legal') return {}
  return buildMetadata({
    title: page.meta?.title ?? page.title,
    description: page.meta?.description ?? null,
    path: `/${slug}`,
  })
}

export default async function GenericPage({ params }: Params) {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  // Юридические страницы доступны только по /legal/[slug].
  if (!page || page.section === 'legal') notFound()
  return <RenderBlocks blocks={page.layout} />
}
