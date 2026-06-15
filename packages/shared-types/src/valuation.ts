/**
 * Контракты оценки (ТЗ §10.1, §10.2, §12). Зеркало apps/engine/app/schemas/valuation.py.
 */
import type { Currency, ExpressValuationResult, Operation, Segment } from './index'

export interface ValuationRequest {
  adminUnitId?: number
  lon?: number
  lat?: number
  segment: Segment
  operation: Operation
  area: number
  period?: string
  floor?: number
  totalFloors?: number
}

export interface Comparable {
  id: number
  area: number
  price: number
  pricePerSqm: number
  distanceM: number
  publishedAt?: string | null
  weight: number
}

export interface Adjustment {
  factor: string
  description: string
  coefficient: number
}

export interface DetailedValuationResult extends ExpressValuationResult {
  pricePerSqm: number
  adminUnitName?: string | null
  period?: string | null
  comparables: Comparable[]
  adjustments: Adjustment[]
  methodology: string
}

export type { Currency }
