import type { Entitlement } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

import { getPaymentProvider } from './providers'

// Авто-рекуррент period-доступов + dunning (ТЗ §11). Запускается по cron-роуту.
// Логика:
//   • active, до конца периода ≤ окна → списать по токену; успех → продлить;
//     отказ → past_due + грейс (доступ сохраняется до pastDueUntil).
//   • past_due → если грейс истёк (pastDueUntil ≤ now) → expired (доступ закрыт);
//     иначе повторить списание (retry); успех → снова active.
// Деньги — копейки. Валюта по умолчанию UAH (рынок).

export interface RenewalReport {
  now: string
  checked: number
  renewed: number[]
  pastDue: number[]
  retriedOk: number[]
  expired: number[]
  failed: number[]
}

interface RenewalOptions {
  now?: number
  /** За сколько дней до конца периода пытаться продлить active. */
  renewWindowDays?: number
  /** Длительность грейса при первом отказе, дней. */
  graceDays?: number
  currency?: string
}

const DAY = 86_400_000

function idOf(ref: number | string | { id: number | string } | null | undefined): number | null {
  if (ref == null) return null
  if (typeof ref === 'number') return ref
  if (typeof ref === 'string') return Number(ref)
  return typeof ref.id === 'number' ? ref.id : Number(ref.id)
}

function moduleTitle(ent: Entitlement): string {
  const m = ent.module
  return typeof m === 'object' && m ? m.name : 'модуль'
}

export async function processRenewals(opts: RenewalOptions = {}): Promise<RenewalReport> {
  const payload = await getPayloadClient()
  const now = opts.now ?? Date.now()
  const windowMs = (opts.renewWindowDays ?? 1) * DAY
  const graceDays = opts.graceDays ?? 3
  const currency = opts.currency ?? 'UAH'
  const provider = getPaymentProvider()

  const report: RenewalReport = {
    now: new Date(now).toISOString(),
    checked: 0,
    renewed: [],
    pastDue: [],
    retriedOk: [],
    expired: [],
    failed: [],
  }

  // Кандидаты: period + автопродление + есть токен + сумма/длительность заданы.
  const res = await payload.find({
    collection: 'entitlements',
    where: {
      and: [
        { accessType: { equals: 'period' } },
        { autoRenew: { equals: true } },
        { status: { in: ['active', 'past_due'] } },
        { cardToken: { exists: true } },
      ],
    },
    depth: 1,
    limit: 500,
    overrideAccess: true,
  })

  for (const ent of res.docs) {
    report.checked++
    const token = ent.cardToken
    const amount = ent.renewPriceMinor ?? 0
    const periodDays = ent.renewPeriodDays ?? 0
    if (!token || amount <= 0 || periodDays <= 0) continue

    // Грейс истёк → закрыть доступ (до любых попыток списания).
    if (ent.status === 'past_due') {
      const graceEnd = ent.pastDueUntil ? new Date(ent.pastDueUntil).getTime() : 0
      if (graceEnd <= now) {
        await payload.update({
          collection: 'entitlements',
          id: ent.id,
          overrideAccess: true,
          data: { status: 'expired' },
        })
        report.expired.push(ent.id)
        continue
      }
    } else {
      // active: продлевать только в пределах окна до конца периода.
      const end = ent.periodEnd ? new Date(ent.periodEnd).getTime() : 0
      if (end > now + windowMs) continue // ещё рано
    }

    if (!provider.chargeByToken) {
      payload.logger.warn(`[renewals] провайдер ${provider.name} не поддерживает chargeByToken`)
      continue
    }

    const charge = await provider.chargeByToken({
      token,
      amountMinor: amount,
      currency,
      reference: `renew-ent-${ent.id}`,
      description: `Авто-продовження: ${moduleTitle(ent)}`,
    })

    const wasPastDue = ent.status === 'past_due'

    if (charge.ok) {
      const base = Math.max(now, ent.periodEnd ? new Date(ent.periodEnd).getTime() : now)
      const newEnd = new Date(base + periodDays * DAY).toISOString()
      await payload.update({
        collection: 'entitlements',
        id: ent.id,
        overrideAccess: true,
        data: { periodEnd: newEnd, status: 'active', pastDueUntil: null },
      })
      await writeReceipt(payload, ent, amount, currency, provider.name, charge.providerChargeId)
      if (wasPastDue) report.retriedOk.push(ent.id)
      else report.renewed.push(ent.id)
      continue
    }

    // Отказ списания.
    if (wasPastDue) {
      // Грейс ещё идёт — оставляем past_due, повторим в следующий прогон.
      report.failed.push(ent.id)
    } else {
      await payload.update({
        collection: 'entitlements',
        id: ent.id,
        overrideAccess: true,
        data: {
          status: 'past_due',
          pastDueUntil: new Date(now + graceDays * DAY).toISOString(),
        },
      })
      report.pastDue.push(ent.id)
    }
  }

  return report
}

// Чек-квитанция о продлении: заказ создаётся сразу как fulfilled (хук afterChange
// срабатывает лишь на переходе в paid при update — двойной выдачи не будет).
async function writeReceipt(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  ent: Entitlement,
  amountMinor: number,
  currency: string,
  providerName: 'mock' | 'monobank' | 'liqpay',
  chargeId?: string,
): Promise<void> {
  const userId = idOf(ent.user)
  const orgId = idOf(ent.organization)
  const nowIso = new Date().toISOString()
  try {
    await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        user: userId ?? undefined,
        organization: orgId ?? undefined,
        status: 'fulfilled',
        items: [
          {
            refType: 'plan',
            qty: 1,
            priceMinorSnapshot: amountMinor,
            titleSnapshot: `Авто-продовження: ${moduleTitle(ent)}`,
          },
        ],
        totalMinor: amountMinor,
        currency: currency as 'UAH' | 'USD' | 'EUR',
        paymentMethod: 'card',
        provider: providerName,
        paymentRef: chargeId,
        paidAt: nowIso,
        fulfilledAt: nowIso,
      },
    })
  } catch (err) {
    payload.logger.warn(`[renewals] receipt order failed for ent ${ent.id}: ${String(err)}`)
  }
}
