'use server'

import { getCurrentUser } from '@/lib/auth'
import { consumeQuota } from '@/lib/billing/quota'

const ENGINE = () => process.env.ENGINE_BASE_URL || 'http://localhost:8000'

export interface BatchRow {
  label: string
  value: number
  pricePerSqm: number
  confidence: number
  comparablesCount: number
  adminUnitName?: string | null
}
export interface BatchState {
  error?: string
  result?: { items: BatchRow[]; total: number; count: number; valued: number }
}

// Портфельна оцінка: парсим перечень объектов (рядок «назва;площа» або просто площа),
// списываем 1 запрос квоты и батчем оцениваем через engine.
export async function runBatch(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'auth' }

  const adminUnitId = Number(formData.get('adminUnitId')) || undefined
  const segment = String(formData.get('segment') ?? 'apartment')
  const operation = String(formData.get('operation') ?? 'sale')
  const raw = String(formData.get('objects') ?? '')

  const items = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split(/[;\t]/).map((s) => s.trim())
      const label = parts.length >= 2 ? parts[0] : `Об'єкт ${i + 1}`
      const areaStr = (parts.length >= 2 ? parts[1] : parts[0]).replace(',', '.')
      return { label, adminUnitId, segment, operation, area: Number(areaStr) }
    })
    .filter((it) => Number.isFinite(it.area) && it.area > 0)
    .slice(0, 500)

  if (!adminUnitId || items.length === 0) return { error: 'invalid' }

  const runId = String(formData.get('runId') ?? '')
  const q = await consumeQuota(user, 'portfolio-valuation', { runId: runId || undefined })
  if (!q.ok) return { error: 'quota' }

  const res = await fetch(`${ENGINE()}/api/valuation/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) return { error: 'engine' }
  return { result: (await res.json()) as BatchState['result'] }
}
