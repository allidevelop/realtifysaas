'use server'

import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { startCheckout } from '@/lib/billing/checkout'
import { isModuleKey } from '@/lib/billing/modules'
import { mockSign } from '@/lib/billing/providers/mock'
import { getPaymentProvider } from '@/lib/billing/providers'
import { consumeQuota } from '@/lib/billing/quota'
import { getPayloadClient } from '@/lib/payload'
import { handleProviderWebhook } from '@/lib/billing/webhook'

function idOf(ref: number | string | { id: number | string } | null | undefined): number | null {
  if (ref == null) return null
  if (typeof ref === 'number') return ref
  if (typeof ref === 'string') return Number(ref)
  return typeof ref.id === 'number' ? ref.id : Number(ref.id)
}

// Купить пакет → создать заказ + счёт → редирект на оплату (card) или счёт (invoice).
export async function buyPackAction(formData: FormData): Promise<void> {
  const packId = Number(formData.get('packId'))
  const paymentMethod = formData.get('paymentMethod') === 'invoice' ? 'invoice' : 'card'

  const user = await getCurrentUser()
  if (!user) redirect('/account/login')
  if (!Number.isFinite(packId)) redirect('/account/billing?error=bad-pack')

  // Реквизиты юрлица — только для безнала.
  const legalEntity =
    paymentMethod === 'invoice'
      ? {
          name: String(formData.get('le_name') ?? '').trim() || undefined,
          edrpou: String(formData.get('le_edrpou') ?? '').trim() || undefined,
          ipn: String(formData.get('le_ipn') ?? '').trim() || undefined,
        }
      : undefined

  // Корп-покупка: доступ выдаётся организации, которой владеет пользователь.
  let organizationId: number | undefined
  if (formData.get('forOrg') === 'on') {
    const payload = await getPayloadClient()
    const orgs = await payload.find({
      collection: 'organizations',
      where: { owner: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    organizationId = orgs.docs[0]?.id
  }

  const result = await startCheckout({
    user: { id: user.id, email: user.email, name: user.name },
    packId,
    paymentMethod,
    legalEntity,
    organizationId,
  })

  if (result.mode === 'invoice') {
    redirect(`/account/orders/${result.orderId}/invoice`)
  }
  redirect(result.payUrl ?? '/account/billing')
}

// Вкл/выкл авто-продление period-доступа. Авторизация: личный доступ пользователя
// либо доступ его организации, где он владелец. При включении нужен токен карты —
// для mock-провайдера генерируем демо-токен; для боевого нужна токенизированная оплата.
export async function setAutoRenewAction(formData: FormData): Promise<void> {
  const entId = Number(formData.get('entitlementId'))
  const enable = formData.get('enable') === 'on'

  const user = await getCurrentUser()
  if (!user) redirect('/account/login')
  if (!Number.isFinite(entId)) redirect('/account/billing')

  const payload = await getPayloadClient()
  const ent = await payload
    .findByID({ collection: 'entitlements', id: entId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!ent || ent.accessType !== 'period') redirect('/account/billing?error=ent')

  // Авторизация субъекта.
  let allowed = idOf(ent.user) === user.id
  const entOrg = idOf(ent.organization)
  if (!allowed && entOrg) {
    const owned = await payload.find({
      collection: 'organizations',
      where: { and: [{ id: { equals: entOrg } }, { owner: { equals: user.id } }] },
      limit: 1,
      overrideAccess: true,
    })
    allowed = owned.docs.length > 0
  }
  if (!allowed) redirect('/account/billing?error=forbidden')

  const data: Record<string, unknown> = { autoRenew: enable }
  if (enable && !ent.cardToken) {
    const provider = getPaymentProvider()
    // Mock: детерминированный демо-токен. Боевой: оставляем пустым — нужна
    // токенизированная карта (иначе рекуррент пропустит запись).
    if (provider.name === 'mock') data.cardToken = `mock_card_${ent.id}`
  }
  await payload.update({ collection: 'entitlements', id: entId, overrideAccess: true, data })
  redirect('/account/billing?ok=autorenew')
}

// Запуск модуля: списать 1 единицу квоты (stub-вычисление в этой фазе).
export async function runModuleAction(formData: FormData): Promise<void> {
  const moduleKey = String(formData.get('module') ?? '')
  const runId = String(formData.get('runId') ?? '')
  if (!isModuleKey(moduleKey)) redirect('/account')

  const user = await getCurrentUser()
  if (!user) redirect('/account/login')

  const res = await consumeQuota(user, moduleKey, { runId: runId || undefined })
  const qs = res.ok ? `ran=1&remaining=${res.remaining}` : `error=${res.reason ?? 'denied'}`
  redirect(`/account/${moduleKey}?${qs}`)
}

// Эмуляция оплаты (только мок-провайдер): шлёт подписанный вебхук в обработчик
// в процессе — без сети. Доступно лишь при PAYMENTS_PROVIDER=mock.
export async function mockPayAction(formData: FormData): Promise<void> {
  if ((process.env.PAYMENTS_PROVIDER || 'mock') !== 'mock') redirect('/account/billing')

  const invoiceId = String(formData.get('invoiceId') ?? '')
  const decision = formData.get('decision') === 'fail' ? 'failure' : 'success'

  const payload = await getPayloadClient()
  const orders = await payload.find({
    collection: 'orders',
    where: { paymentRef: { equals: invoiceId } },
    limit: 1,
    overrideAccess: true,
  })
  const order = orders.docs[0]
  if (!order) redirect('/account')

  const body = JSON.stringify({
    invoiceId,
    status: decision,
    amount: order.totalMinor,
    ccy: 980,
    reference: order.orderNumber,
  })
  await handleProviderWebhook('mock', body, new Headers({ 'x-mock-sign': mockSign(body) }))
  redirect(`/account/billing/return?order=${order.id}`)
}
