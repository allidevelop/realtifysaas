import { DEFAULT_LOCALE } from './constants'
import { getPayloadClient } from './payload'

// Серверные запросы к CMS (ТЗ §8). Везде фильтруем published/active и берём
// контент в локали по умолчанию (uk) с fallback.

type Locale = 'uk' | 'en'

export async function getSiteSettings(locale: Locale = DEFAULT_LOCALE) {
  const payload = await getPayloadClient()
  return payload.findGlobal({ slug: 'site-settings', locale, depth: 1 })
}

export async function getPageBySlug(slug: string, locale: Locale = DEFAULT_LOCALE) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'pages',
    where: {
      slug: { equals: slug },
      _status: { equals: 'published' },
    },
    locale,
    depth: 2,
    limit: 1,
  })
  return res.docs[0] ?? null
}

export async function getPublishedPages(section?: 'general' | 'legal') {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'pages',
    where: {
      _status: { equals: 'published' },
      ...(section ? { section: { equals: section } } : {}),
    },
    locale: DEFAULT_LOCALE,
    depth: 0,
    limit: 200,
    pagination: false,
  })
  return res.docs
}

export async function getNewsList(locale: Locale = DEFAULT_LOCALE, limit = 24) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'news',
    where: { _status: { equals: 'published' } },
    sort: '-publishedAt',
    locale,
    depth: 1,
    limit,
  })
  return res.docs
}

export async function getNewsBySlug(slug: string, locale: Locale = DEFAULT_LOCALE) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'news',
    where: {
      slug: { equals: slug },
      _status: { equals: 'published' },
    },
    locale,
    depth: 1,
    limit: 1,
  })
  return res.docs[0] ?? null
}

export async function getTools(locale: Locale = DEFAULT_LOCALE) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'tools',
    where: { isActive: { equals: true } },
    sort: 'order',
    locale,
    depth: 1,
    limit: 100,
  })
  return res.docs
}

export async function getToolBySlug(slug: string, locale: Locale = DEFAULT_LOCALE) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'tools',
    where: { slug: { equals: slug } },
    locale,
    depth: 1,
    limit: 1,
  })
  return res.docs[0] ?? null
}

export async function getServicePlans(locale: Locale = DEFAULT_LOCALE) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'service-plans',
    where: { isActive: { equals: true } },
    sort: 'order',
    locale,
    depth: 0,
    limit: 50,
  })
  return res.docs
}

export async function getTeam(locale: Locale = DEFAULT_LOCALE) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'team-members',
    sort: 'order',
    locale,
    depth: 1,
    limit: 100,
  })
  return res.docs
}

export async function getPartners(locale: Locale = DEFAULT_LOCALE) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'partners',
    sort: 'order',
    locale,
    depth: 1,
    limit: 100,
  })
  return res.docs
}
