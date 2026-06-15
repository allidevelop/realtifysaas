// Серверные вызовы аналитики/объявлений engine (ТЗ §8.1). Фронт — через прокси
// кабинета (auth + квота на экспорт).

const ENGINE = () => process.env.ENGINE_BASE_URL || 'http://localhost:8000'

export interface Listing {
  id: number
  segment: string
  operation: string
  area: number | null
  price: number | null
  currency: string
  published: string
  unit: string
  pricePerSqm: number | null
}

export interface ListingsResult {
  items: Listing[]
  total: number
}

export interface SeriesResult {
  periods: string[]
  segments: string[]
  trend: Record<string, number | string>[]
  latest: string | null
  bySegment: { segment: string; value: number }[]
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  }
  return sp.toString()
}

export async function searchListings(
  params: Record<string, string | number | undefined>,
): Promise<ListingsResult> {
  const res = await fetch(`${ENGINE()}/api/listings/search?${qs(params)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`engine listings/search HTTP ${res.status}`)
  return (await res.json()) as ListingsResult
}

export async function getSeries(
  params: Record<string, string | number | undefined>,
): Promise<SeriesResult> {
  const res = await fetch(`${ENGINE()}/api/analytics/series?${qs(params)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`engine analytics/series HTTP ${res.status}`)
  return (await res.json()) as SeriesResult
}
