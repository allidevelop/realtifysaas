import type { Payload } from 'payload'

import type { Entitlement, Order, ServicePlan } from '@/payload-types'

import { findActiveEntitlement } from './entitlements'
import { getRedis, quotaKey } from './redis'

// Идемпотентная выдача доступов по оплаченному заказу (ТЗ §11).
// Вызывается из вебхука (M3) и хука Orders afterChange (M3).
export async function applyPaidOrder(payload: Payload, orderId: number | string): Promise<void> {
  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 2,
    overrideAccess: true,
  })) as Order

  if (!order) return
  if (order.status === 'fulfilled') return // уже исполнен — идемпотентность
  if (order.status !== 'paid') return // выдаём только по paid

  const userId = idOf(order.user)
  if (!userId) {
    payload.logger.warn(`[fulfillment] order ${orderId} без user — пропуск`)
    return
  }

  for (const item of order.items ?? []) {
    if (item.refType !== 'plan') continue
    const pack = typeof item.plan === 'object' ? (item.plan as ServicePlan) : null
    if (!pack) continue
    const qty = item.qty ?? 1
    const moduleIds = collectModuleIds(pack)
    for (const moduleId of moduleIds) {
      await grantEntitlement(payload, userId, moduleId, pack, qty, Number(order.id))
    }
  }

  await payload.update({
    collection: 'orders',
    id: orderId,
    data: { status: 'fulfilled', fulfilledAt: new Date().toISOString() },
    overrideAccess: true,
  })
}

function collectModuleIds(pack: ServicePlan): number[] {
  const ids: number[] = []
  const main = idOf(pack.module)
  if (main) ids.push(main)
  for (const g of pack.grantsModules ?? []) {
    const gid = idOf(g)
    if (gid && !ids.includes(gid)) ids.push(gid)
  }
  return ids
}

async function grantEntitlement(
  payload: Payload,
  userId: number,
  moduleId: number,
  pack: ServicePlan,
  qty: number,
  orderId: number,
): Promise<void> {
  const accessType = pack.accessType === 'period' ? 'period' : 'quota'
  const existing = await findActiveEntitlement(userId, moduleId, accessType)

  if (accessType === 'quota') {
    const add = (pack.quota ?? 0) * qty
    if (existing) {
      const newRemaining = (existing.quotaRemaining ?? 0) + add
      await payload.update({
        collection: 'entitlements',
        id: existing.id,
        data: {
          quotaTotal: (existing.quotaTotal ?? 0) + add,
          quotaRemaining: newRemaining,
          status: 'active',
          sourceOrders: appendOrder(existing, orderId),
        },
        overrideAccess: true,
      })
      await getRedis().del(quotaKey(existing.id))
    } else {
      const created = await payload.create({
        collection: 'entitlements',
        data: {
          user: userId,
          module: moduleId,
          accessType: 'quota',
          quotaTotal: add,
          quotaRemaining: add,
          status: 'active',
          sourceOrders: [orderId],
        },
        overrideAccess: true,
      })
      await getRedis().del(quotaKey(created.id))
    }
    return
  }

  // period
  const addDays = (pack.periodDays ?? 0) * qty
  const base =
    existing?.periodEnd && new Date(existing.periodEnd).getTime() > Date.now()
      ? new Date(existing.periodEnd).getTime()
      : Date.now()
  const newEnd = new Date(base + addDays * 86_400_000).toISOString()

  if (existing) {
    await payload.update({
      collection: 'entitlements',
      id: existing.id,
      data: { periodEnd: newEnd, status: 'active', sourceOrders: appendOrder(existing, orderId) },
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'entitlements',
      data: {
        user: userId,
        module: moduleId,
        accessType: 'period',
        periodEnd: newEnd,
        status: 'active',
        sourceOrders: [orderId],
      },
      overrideAccess: true,
    })
  }
}

function appendOrder(ent: Entitlement, orderId: number): number[] {
  const ids = (ent.sourceOrders ?? []).map(idOf).filter((x): x is number => typeof x === 'number')
  if (!ids.includes(orderId)) ids.push(orderId)
  return ids
}

function idOf(ref: number | string | { id: number | string } | null | undefined): number | null {
  if (ref == null) return null
  if (typeof ref === 'number') return ref
  if (typeof ref === 'string') return Number(ref)
  return typeof ref.id === 'number' ? ref.id : Number(ref.id)
}
