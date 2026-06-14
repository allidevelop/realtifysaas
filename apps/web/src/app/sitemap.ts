import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/constants'
import { getNewsList, getPublishedPages, getTools } from '@/lib/queries'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, legal, tools, news] = await Promise.all([
    getPublishedPages('general'),
    getPublishedPages('legal'),
    getTools(),
    getNewsList(),
  ])

  const staticRoutes = ['/', '/tools', '/pricing', '/news'].map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: 'weekly' as const,
    priority: path === '/' ? 1 : 0.7,
  }))

  const pageRoutes = pages
    .filter((p) => p.slug !== 'home')
    .map((p) => ({ url: new URL(`/${p.slug}`, SITE_URL).toString(), priority: 0.6 }))

  const legalRoutes = legal.map((p) => ({
    url: new URL(`/legal/${p.slug}`, SITE_URL).toString(),
    priority: 0.3,
  }))

  const toolRoutes = tools.map((t) => ({
    url: new URL(`/tools/${t.slug}`, SITE_URL).toString(),
    priority: 0.6,
  }))

  const newsRoutes = news.map((n) => ({
    url: new URL(`/news/${n.slug}`, SITE_URL).toString(),
    lastModified: n.updatedAt,
    priority: 0.5,
  }))

  return [...staticRoutes, ...pageRoutes, ...legalRoutes, ...toolRoutes, ...newsRoutes]
}
