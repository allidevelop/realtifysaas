import type { User } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

import { resolveModuleAccess } from './entitlements'
import type { ModuleKey } from './modules'
import { getRedis, quotaKey } from './redis'
import type { ConsumeResult } from './types'

// Lua: check-and-decrement. Возвращает новый остаток (>=0), -1 если недостаточно,
// -2 если ключ не засеян (тогда засеваем из БД и повторяем).
const DECR_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if cur == false then return -2 end
local c = tonumber(cur)
local n = tonumber(ARGV[1])
if c < n then return -1 end
return redis.call('DECRBY', KEYS[1], n)
`

interface ConsumeOptions {
  n?: number
  /** Идемпотентность «запуска»: повторный runId не списывает повторно. */
  runId?: string
}

// Атомарно списать n единиц квоты модуля у пользователя (ТЗ §8.4, §10.2).
export async function consumeQuota(
  user: Pick<User, 'id'>,
  moduleKey: ModuleKey,
  opts: ConsumeOptions = {},
): Promise<ConsumeResult> {
  const n = Math.max(1, opts.n ?? 1)
  const access = await resolveModuleAccess(user, moduleKey)

  if (access.accessType !== 'quota') {
    // free/period — квота не списывается.
    return { ok: access.allowed, remaining: Number.POSITIVE_INFINITY, reason: access.reason }
  }
  if (!access.allowed || !access.entitlement) {
    return { ok: false, remaining: access.quotaRemaining ?? 0, reason: access.reason }
  }

  const ent = access.entitlement
  const redis = getRedis()
  const key = quotaKey(ent.id)

  // Идемпотентность запуска.
  if (opts.runId) {
    const acquired = await redis.set(`run:${opts.runId}`, '1', 'EX', 60, 'NX')
    if (acquired === null) {
      return { ok: true, remaining: ent.quotaRemaining ?? 0 }
    }
  }

  const evalDecr = async () => Number(await redis.eval(DECR_SCRIPT, 1, key, String(n)))

  let result = await evalDecr()
  if (result === -2) {
    // Засев из БД (authoritative). NX — не затираем живой счётчик.
    await redis.set(key, String(ent.quotaRemaining ?? 0), 'NX')
    result = await evalDecr()
  }

  if (result === -1 || result === -2) {
    // Недостаточно квоты — синхронизируем статус.
    await markExhausted(ent.id)
    return { ok: false, remaining: 0, reason: 'quota-exhausted' }
  }

  const remaining = result
  // Write-through в БД (источник истины), синхронно — объёмы небольшие.
  await syncRemaining(ent.id, remaining)
  return { ok: true, remaining }
}

async function syncRemaining(entitlementId: number, remaining: number): Promise<void> {
  const payload = await getPayloadClient()
  await payload.update({
    collection: 'entitlements',
    id: entitlementId,
    data: {
      quotaRemaining: remaining,
      lastConsumedAt: new Date().toISOString(),
      status: remaining <= 0 ? 'exhausted' : 'active',
    },
    overrideAccess: true,
  })
}

async function markExhausted(entitlementId: number): Promise<void> {
  const payload = await getPayloadClient()
  await payload.update({
    collection: 'entitlements',
    id: entitlementId,
    data: { quotaRemaining: 0, status: 'exhausted' },
    overrideAccess: true,
  })
}
