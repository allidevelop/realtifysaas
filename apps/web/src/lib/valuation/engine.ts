import type { DetailedValuationResult, ValuationRequest } from '@realtify/shared-types'

// Вызов движка оценки engine (ТЗ §10.2).
const ENGINE = () => process.env.ENGINE_BASE_URL || 'http://localhost:8000'

export async function callValuation(
  mode: 'express' | 'detailed',
  req: ValuationRequest,
): Promise<DetailedValuationResult> {
  const res = await fetch(`${ENGINE()}/api/valuation/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`engine valuation/${mode} HTTP ${res.status}`)
  return (await res.json()) as DetailedValuationResult
}
