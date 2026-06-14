'use server'

import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { startCheckout } from '@/lib/billing/checkout'
import { isModuleKey } from '@/lib/billing/modules'
import { mockSign } from '@/lib/billing/providers/mock'
import { consumeQuota } from '@/lib/billing/quota'
import { getPayloadClient } from '@/lib/payload'
import { handleProviderWebhook } from '@/lib/billing/webhook'

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

  const result = await startCheckout({
    user: { id: user.id, email: user.email, name: user.name },
    packId,
    paymentMethod,
    legalEntity,
  })

  if (result.mode === 'invoice') {
    redirect(`/account/orders/${result.orderId}/invoice`)
  }
  redirect(result.payUrl ?? '/account/billing')
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
