import type { Entitlement, Module } from '@/payload-types'

import type { ModuleKey } from './modules'

// Внутренние типы движка биллинга (публичный контракт DTO — в shared-types, M5).

export type DenyReason = 'unauthenticated' | 'no-entitlement' | 'quota-exhausted' | 'period-expired'

export interface ModuleAccess {
  moduleKey: ModuleKey
  accessType: 'quota' | 'period' | 'free'
  allowed: boolean
  reason?: DenyReason
  entitlement?: Entitlement
  quotaRemaining?: number
  periodEnd?: string | null
}

export interface ConsumeResult {
  ok: boolean
  remaining: number
  reason?: DenyReason
}

export function moduleKeyOf(module: number | Module | null | undefined): ModuleKey | null {
  if (module && typeof module === 'object' && 'key' in module) {
    return module.key as ModuleKey
  }
  return null
}
