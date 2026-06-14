import type { Metadata } from 'next'
import Link from 'next/link'

import { RenderBlocks } from '@/components/blocks/RenderBlocks'
import { getPageBySlug } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug('home')
  return buildMetadata({
    title: page?.meta?.title ?? null,
    description: page?.meta?.description ?? null,
    path: '/',
  })
}

export default async function HomePage() {
  const page = await getPageBySlug('home')

  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold text-ink-900">Realtify</h1>
        <p className="mt-3 text-ink-500">
          Главная страница ещё не создана в CMS. Запустите наполнение:{' '}
          <code className="rounded bg-ink-100 px-1.5 py-0.5">pnpm --filter web seed</code> или
          добавьте страницу со slug <b>home</b> в{' '}
          <Link className="text-brand-600" href="/admin">
            админке
          </Link>
          .
        </p>
      </div>
    )
  }

  return <RenderBlocks blocks={page.layout} />
}
