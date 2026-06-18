import type { Metadata } from 'next'
import Link from 'next/link'

import { Section, SectionHeading } from '@/components/Section'
import { formatDate } from '@/lib/format'
import { getNewsList } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Новости',
    description: 'Аналитика и новости рынка недвижимости от Realtify.',
    path: '/news',
  })
}

export default async function NewsListPage() {
  const news = await getNewsList()
  return (
    <Section>
      <SectionHeading title="Новости" intro="Аналитика и обновления платформы." />
      {news.length === 0 ? (
        <p className="text-center text-ink-500">Публикаций пока нет.</p>
      ) : (
        <div className="mx-auto grid max-w-4xl gap-6">
          {news.map((item) => (
            <Link
              key={item.id}
              href={`/news/${item.slug}`}
              className="group rounded-xl border border-ink-100 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              {item.publishedAt && (
                <time className="text-xs uppercase tracking-wide text-ink-500">
                  {formatDate(item.publishedAt)}
                </time>
              )}
              <h2 className="mt-1 text-xl font-semibold text-ink-900 group-hover:text-brand-700">
                {item.title}
              </h2>
              {item.excerpt && <p className="mt-2 text-sm text-ink-500">{item.excerpt}</p>}
            </Link>
          ))}
        </div>
      )}
    </Section>
  )
}
