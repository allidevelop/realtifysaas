// Серверный вызов гео-API engine (ТЗ §9). Фронт ходит сюда через прокси-роуты
// кабинета (там — freemium-гейтинг глубины), не напрямую в engine.

const ENGINE = () => process.env.ENGINE_BASE_URL || 'http://localhost:8000'

export async function engineGeo<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const url = `${ENGINE()}/api/geo/${path}?${qs.toString()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`engine geo/${path} HTTP ${res.status}`)
  return (await res.json()) as T
}

export interface GeoMeta {
  periods: string[]
  segments: string[]
  operations: string[]
  metrics: string[]
}

export interface GeoMetricsResponse {
  period: string
  metric: string
  currency: string
  values: Record<string, number>
}

export interface UnitOption {
  id: number
  name: string
  parentName: string | null
}

export async function getAdminUnitOptions(level = 2): Promise<UnitOption[]> {
  const d = await engineGeo<{ items: UnitOption[] }>('admin-list', { level })
  return d.items
}
