import type { Entitlement, Module, User } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

import type { ModuleKey } from './modules'
import type { ModuleAccess } from './types'

// Загрузка модуля по ключу (с кэшем на процесс — каталог меняется редко).
const moduleCache = new Map<ModuleKey, Module>()

export async function getModuleByKey(key: ModuleKey): Promise<Module | null> {
  const cached = moduleCache.get(key)
  if (cached) return cached
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'modules',
    where: { key: { equals: key } },
    limit: 1,
    overrideAccess: true,
  })
  const mod = res.docs[0] ?? null
  if (mod) moduleCache.set(key, mod)
  return mod
}

// Все активные не-истёкшие entitlements пользователя (module populated).
export async function getUserEntitlements(user: Pick<User, 'id'>): Promise<Entitlement[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'entitlements',
    where: {
      user: { equals: user.id },
      status: { equals: 'active' },
    },
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })
  return res.docs
}

// Активный entitlement пользователя для конкретного модуля и типа доступа.
export async function findActiveEntitlement(
  userId: number,
  moduleId: number,
  accessType: 'quota' | 'period',
): Promise<Entitlement | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'entitlements',
    where: {
      user: { equals: userId },
      module: { equals: moduleId },
      accessType: { equals: accessType },
      status: { equals: 'active' },
    },
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}

// Резолв доступа пользователя к модулю (ТЗ §8.4 гейтинг).
export async function resolveModuleAccess(
  user: Pick<User, 'id'> | null,
  moduleKey: ModuleKey,
): Promise<ModuleAccess> {
  const mod = await getModuleByKey(moduleKey)
  const accessType = (mod?.accessType ?? 'quota') as 'quota' | 'period' | 'free'

  if (!user) {
    return { moduleKey, accessType, allowed: false, reason: 'unauthenticated' }
  }
  if (accessType === 'free') {
    return { moduleKey, accessType, allowed: true }
  }
  if (!mod) {
    return { moduleKey, accessType, allowed: false, reason: 'no-entitlement' }
  }

  const ent = await findActiveEntitlement(user.id, mod.id, accessType)
  if (!ent) {
    return { moduleKey, accessType, allowed: false, reason: 'no-entitlement' }
  }

  if (accessType === 'quota') {
    const remaining = ent.quotaRemaining ?? 0
    return remaining > 0
      ? { moduleKey, accessType, allowed: true, entitlement: ent, quotaRemaining: remaining }
      : { moduleKey, accessType, allowed: false, reason: 'quota-exhausted', entitlement: ent, quotaRemaining: 0 }
  }

  // period
  const active = ent.periodEnd ? new Date(ent.periodEnd).getTime() > Date.now() : false
  return active
    ? { moduleKey, accessType, allowed: true, entitlement: ent, periodEnd: ent.periodEnd }
    : { moduleKey, accessType, allowed: false, reason: 'period-expired', entitlement: ent, periodEnd: ent.periodEnd }
}
