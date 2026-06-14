import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { Section } from '@/components/Section'
import { SITE_NAME, SITE_URL } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { getNewsBySlug, getNewsList } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

export async function generateStaticParams() {
  const news = await getNewsList()
  return news.map((n) => ({ slug: n.slug }))
}

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const item = await getNewsBySlug(slug)
  if (!item) return {}
  return buildMetadata({
    title: item.meta?.title ?? item.title,
    description: item.meta?.description ?? item.excerpt ?? null,
    path: `/news/${slug}`,
  })
}

export default async function NewsArticlePage({ params }: Params) {
  const { slug } = await params
  const item = await getNewsBySlug(slug)
  if (!item) notFound()

  // JSON-LD Article (ТЗ §13).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.title,
    datePublished: item.publishedAt ?? item.createdAt,
    dateModified: item.updatedAt,
    description: item.excerpt ?? undefined,
    publisher: { '@type': 'Organization', name: SITE_NAME },
    mainEntityOfPage: `${SITE_URL}/news/${slug}`,
  }

  return (
    <Section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto max-w-3xl">
        {item.publishedAt && (
          <time className="text-sm uppercase tracking-wide text-ink-500">
            {formatDate(item.publishedAt)}
          </time>
        )}
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">{item.title}</h1>
        {item.excerpt && <p className="mt-4 text-lg text-ink-500">{item.excerpt}</p>}
        <RichText data={item.content} className="mt-8" />
      </article>
    </Section>
  )
}
