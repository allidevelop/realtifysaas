'use server'

import type {
  DetailedValuationResult,
  Operation,
  Segment,
  ValuationRequest,
} from '@realtify/shared-types'

import { getCurrentUser } from '@/lib/auth'
import { isModuleKey, type ModuleKey } from '@/lib/billing/modules'
import { consumeQuota } from '@/lib/billing/quota'
import { callValuation } from '@/lib/valuation/engine'

export interface ValuationState {
  result?: DetailedValuationResult
  error?: string
  remaining?: number
}

// Запуск оценки: списывает квоту модуля (1) → вызывает движок engine.
// Квота списывается до вызова (модель «запуск = списание»); refund при сбое — TODO.
export async function runValuation(
  _prev: ValuationState,
  formData: FormData,
): Promise<ValuationState> {
  const moduleKey = String(formData.get('module') ?? '')
  const mode = formData.get('mode') === 'detailed' ? 'detailed' : 'express'
  if (!isModuleKey(moduleKey)) return { error: 'bad-module' }

  const user = await getCurrentUser()
  if (!user) return { error: 'auth' }

  const adminUnitId = Number(formData.get('adminUnitId')) || undefined
  const area = Number(formData.get('area')) || 0
  if (!adminUnitId || area <= 0) return { error: 'invalid-input' }

  const req: ValuationRequest = {
    adminUnitId,
    segment: String(formData.get('segment') ?? 'apartment') as Segment,
    operation: String(formData.get('operation') ?? 'sale') as Operation,
    area,
    floor: Number(formData.get('floor')) || undefined,
    totalFloors: Number(formData.get('totalFloors')) || undefined,
  }

  const runId = String(formData.get('runId') ?? '')
  const q = await consumeQuota(user, moduleKey as ModuleKey, { runId: runId || undefined })
  if (!q.ok) return { error: q.reason ?? 'quota-exhausted', remaining: q.remaining }

  try {
    const result = await callValuation(mode, req)
    return { result, remaining: q.remaining }
  } catch {
    return { error: 'engine-error', remaining: q.remaining }
  }
}
