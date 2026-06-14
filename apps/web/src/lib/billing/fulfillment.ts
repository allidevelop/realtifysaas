import type { Payload, PayloadRequest } from 'payload'

import type { Entitlement, Order, ServicePlan } from '@/payload-types'

import { getRedis, quotaKey } from './redis'

// Идемпотентная выдача доступов по оплаченному заказу (ТЗ §11).
// Вызывается из хука Orders.afterChange (передаёт req — ВАЖНО: хук исполняется
// до коммита, поэтому вложенные операции должны идти в той же транзакции, иначе
// читают старое состояние заказа). req также прокидывается из вебхука косвенно.
export async function applyPaidOrder(
  payload: Payload,
  orderId: number | string,
  req?: PayloadRequest,
): Promise<void> {
  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 2,
    overrideAccess: true,
    req,
  })) as Order

  if (!order) return
  if (order.status === 'fulfilled') return // идемпотентность
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
    for (const moduleId of collectModuleIds(pack)) {
      await grantEntitlement(payload, userId, moduleId, pack, qty, Number(order.id), req)
    }
  }

  await payload.update({
    collection: 'orders',
    id: orderId,
    data: { status: 'fulfilled', fulfilledAt: new Date().toISOString() },
    overrideAccess: true,
    req,
  })
}

async function findActiveEntitlement(
  payload: Payload,
  userId: number,
  moduleId: number,
  accessType: 'quota' | 'period',
  req?: PayloadRequest,
): Promise<Entitlement | null> {
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
    req,
  })
  return res.docs[0] ?? null
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
  req?: PayloadRequest,
): Promise<void> {
  const accessType = pack.accessType === 'period' ? 'period' : 'quota'
  const existing = await findActiveEntitlement(payload, userId, moduleId, accessType, req)

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
        req,
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
        req,
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
      req,
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
      req,
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
