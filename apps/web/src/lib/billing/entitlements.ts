import type { Where } from 'payload'

import type { Entitlement, Module, User } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

import type { ModuleKey } from './modules'
import type { ModuleAccess } from './types'

// Субъект доступа: пользователь и (опц.) его организация — доступ может быть личным
// или общим по организации (seats, ТЗ §8.2/§16 этап 6). roles — для админ-байпаса.
export type EntitlementSubject = Pick<User, 'id' | 'organization' | 'roles'>

export function orgIdOf(user: EntitlementSubject): number | null {
  const o = user.organization
  if (o == null) return null
  return typeof o === 'object' ? o.id : o
}

// Админ — безлимитный доступ ко всем модулям (для тестирования и внутреннего использования).
export function isAdminSubject(user: EntitlementSubject | null): boolean {
  return Boolean(user?.roles?.includes('admin'))
}

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

// Условие «личный ИЛИ организационный» доступ.
function subjectWhere(user: EntitlementSubject): Where {
  const oid = orgIdOf(user)
  const ors: Where[] = [{ user: { equals: user.id } }]
  if (oid) ors.push({ organization: { equals: oid } })
  return { or: ors }
}

// Активные/грейс entitlements пользователя и его организации (module populated).
export async function getUserEntitlements(user: EntitlementSubject): Promise<Entitlement[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'entitlements',
    where: {
      and: [subjectWhere(user), { status: { in: ['active', 'past_due'] } }],
    },
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })
  return res.docs
}

// Активный/грейс entitlement субъекта для модуля и типа доступа.
export async function findActiveEntitlement(
  user: EntitlementSubject,
  moduleId: number,
  accessType: 'quota' | 'period',
): Promise<Entitlement | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'entitlements',
    where: {
      and: [
        subjectWhere(user),
        { module: { equals: moduleId } },
        { accessType: { equals: accessType } },
        { status: { in: ['active', 'past_due'] } },
      ],
    },
    sort: '-updatedAt',
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}

// Резолв доступа к модулю (ТЗ §8.4 гейтинг; учёт org-доступа и грейса past_due).
export async function resolveModuleAccess(
  user: EntitlementSubject | null,
  moduleKey: ModuleKey,
): Promise<ModuleAccess> {
  const mod = await getModuleByKey(moduleKey)
  const accessType = (mod?.accessType ?? 'quota') as 'quota' | 'period' | 'free'

  if (!user) {
    return { moduleKey, accessType, allowed: false, reason: 'unauthenticated' }
  }
  // Админ — безлимит на любой модуль (бесконечная квота).
  if (isAdminSubject(user)) {
    return { moduleKey, accessType, allowed: true, quotaRemaining: Number.POSITIVE_INFINITY }
  }
  if (accessType === 'free') {
    return { moduleKey, accessType, allowed: true }
  }
  if (!mod) {
    return { moduleKey, accessType, allowed: false, reason: 'no-entitlement' }
  }

  const ent = await findActiveEntitlement(user, mod.id, accessType)
  if (!ent) {
    return { moduleKey, accessType, allowed: false, reason: 'no-entitlement' }
  }

  if (accessType === 'quota') {
    const remaining = ent.status === 'active' ? (ent.quotaRemaining ?? 0) : 0
    return remaining > 0
      ? { moduleKey, accessType, allowed: true, entitlement: ent, quotaRemaining: remaining }
      : { moduleKey, accessType, allowed: false, reason: 'quota-exhausted', entitlement: ent, quotaRemaining: 0 }
  }

  // period: активен по periodEnd, либо past_due в пределах грейса (pastDueUntil).
  const now = Date.now()
  const periodOk = ent.periodEnd ? new Date(ent.periodEnd).getTime() > now : false
  const graceOk =
    ent.status === 'past_due' && ent.pastDueUntil
      ? new Date(ent.pastDueUntil).getTime() > now
      : false
  const allowed = (ent.status === 'active' && periodOk) || graceOk
  return allowed
    ? { moduleKey, accessType, allowed: true, entitlement: ent, periodEnd: ent.periodEnd }
    : { moduleKey, accessType, allowed: false, reason: 'period-expired', entitlement: ent, periodEnd: ent.periodEnd }
}
