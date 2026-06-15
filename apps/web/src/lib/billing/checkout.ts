import type { Order, User } from '@/payload-types'

import { SITE_URL } from '@/lib/constants'
import { getPayloadClient } from '@/lib/payload'

import { getPaymentProvider } from './providers'

type LegalEntityInput = NonNullable<Order['legalEntity']>

export interface CheckoutInput {
  user: Pick<User, 'id' | 'email' | 'name'>
  packId: number
  paymentMethod: 'card' | 'invoice'
  legalEntity?: LegalEntityInput
  /** Если задано — доступ выдаётся организации (корп-покупка, seats). */
  organizationId?: number
}

export interface CheckoutResult {
  orderId: number
  mode: 'pay' | 'invoice'
  payUrl?: string
}

const webhookBase = () => process.env.WEBHOOK_BASE_URL || SITE_URL

// Оформление покупки пакета (ТЗ §11). card → счёт у провайдера + payUrl;
// invoice (безнал) → заказ awaiting_invoice (счёт-фактуру генерит engine, M5).
export async function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const payload = await getPayloadClient()

  const pack = await payload.findByID({
    collection: 'service-plans',
    id: input.packId,
    depth: 0,
    overrideAccess: true,
  })
  if (!pack || pack.isActive === false) {
    throw new Error('Пакет не найден или неактивен')
  }

  const provider = getPaymentProvider()
  const totalMinor = pack.priceMinor

  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      user: input.user.id,
      organization: input.organizationId,
      status: input.paymentMethod === 'invoice' ? 'awaiting_invoice' : 'new',
      customerName: input.user.name ?? undefined,
      email: input.user.email,
      legalEntity: input.legalEntity,
      items: [
        {
          refType: 'plan',
          plan: pack.id,
          qty: 1,
          priceMinorSnapshot: totalMinor,
          titleSnapshot: pack.name,
        },
      ],
      totalMinor,
      currency: pack.currency,
      paymentMethod: input.paymentMethod,
      provider: input.paymentMethod === 'invoice' ? 'mock' : provider.name,
    },
  })

  if (input.paymentMethod === 'invoice') {
    return { orderId: order.id, mode: 'invoice' }
  }

  const invoice = await provider.createInvoice({
    orderId: order.id,
    amountMinor: totalMinor,
    currency: pack.currency,
    reference: order.orderNumber ?? String(order.id),
    description: pack.name,
    redirectUrl: `${SITE_URL}/account/billing/return?order=${order.id}`,
    webhookUrl: `${webhookBase()}/webhooks/${provider.name}`,
  })

  await payload.update({
    collection: 'orders',
    id: order.id,
    overrideAccess: true,
    data: { paymentRef: invoice.providerInvoiceId, status: 'pending' },
  })

  return { orderId: order.id, mode: 'pay', payUrl: invoice.payUrl }
}
