import { getPayloadClient } from '@/lib/payload'

import { getProviderByName } from './providers'
import type { ProviderName } from './providers/types'

// Общая обработка вебхука провайдера (ТЗ §11): проверка подписи + идемпотентность
// (PaymentEvents.eventId unique) + переход статуса заказа. Фулфилмент доступа
// триггерит хук Orders.afterChange при переходе в paid.

export interface WebhookResult {
  httpStatus: number
  body: { ok: boolean; result?: string; error?: string }
}

export async function handleProviderWebhook(
  providerName: ProviderName,
  rawBody: string,
  headers: Headers,
): Promise<WebhookResult> {
  const payload = await getPayloadClient()
  const provider = getProviderByName(providerName)

  const valid = await provider.verifyWebhook({ rawBody, headers })
  let parsed
  try {
    parsed = provider.parseWebhook(rawBody)
  } catch {
    return { httpStatus: 400, body: { ok: false, error: 'bad-payload' } }
  }

  const eventId = `${parsed.invoiceId}:${parsed.status}`
  let rawJson: Record<string, unknown>
  try {
    rawJson = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    rawJson = { raw: rawBody }
  }

  if (!valid) {
    await safeCreateEvent(payload, {
      eventId: `${eventId}:invalid:${Date.now()}`,
      provider: providerName,
      invoiceId: parsed.invoiceId,
      status: parsed.status,
      signatureValid: false,
      rawPayload: rawJson,
      result: 'error',
      error: 'signature-invalid',
    })
    return { httpStatus: 400, body: { ok: false, error: 'signature-invalid' } }
  }

  // Идемпотентность: повтор того же события — no-op.
  const dup = await payload.find({
    collection: 'payment-events',
    where: { eventId: { equals: eventId } },
    limit: 1,
    overrideAccess: true,
  })
  if (dup.totalDocs > 0) {
    return { httpStatus: 200, body: { ok: true, result: 'duplicate' } }
  }

  // Найти заказ по paymentRef (invoiceId провайдера).
  const orders = await payload.find({
    collection: 'orders',
    where: { paymentRef: { equals: parsed.invoiceId } },
    limit: 1,
    overrideAccess: true,
  })
  const order = orders.docs[0]

  const mapped = provider.mapStatus(parsed.status)
  let result: 'applied' | 'ignored' = 'ignored'

  if (order) {
    if (mapped === 'paid' && order.status !== 'paid' && order.status !== 'fulfilled') {
      // Перевод в paid триггерит Orders.afterChange → applyPaidOrder (фулфилмент).
      await payload.update({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        data: { status: 'paid', paidAt: new Date().toISOString() },
      })
      result = 'applied'
    } else if (mapped === 'failed' && order.status !== 'fulfilled' && order.status !== 'paid') {
      await payload.update({ collection: 'orders', id: order.id, overrideAccess: true, data: { status: 'failed' } })
      result = 'applied'
    } else if (mapped === 'canceled' && order.status !== 'fulfilled' && order.status !== 'paid') {
      await payload.update({ collection: 'orders', id: order.id, overrideAccess: true, data: { status: 'canceled' } })
      result = 'applied'
    }
  }

  await safeCreateEvent(payload, {
    eventId,
    provider: providerName,
    invoiceId: parsed.invoiceId,
    status: parsed.status,
    signatureValid: true,
    rawPayload: rawJson,
    order: order?.id,
    result,
  })

  return { httpStatus: 200, body: { ok: true, result } }
}

interface EventData {
  eventId: string
  provider: ProviderName
  invoiceId: string
  status: string
  signatureValid: boolean
  rawPayload: Record<string, unknown>
  order?: number
  result: 'applied' | 'duplicate' | 'ignored' | 'error'
  error?: string
}

// Создание события идемпотентно: конфликт по eventId трактуем как дубликат.
async function safeCreateEvent(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  data: EventData,
): Promise<void> {
  try {
    await payload.create({
      collection: 'payment-events',
      overrideAccess: true,
      data: {
        eventId: data.eventId,
        provider: data.provider,
        invoiceId: data.invoiceId,
        status: data.status,
        signatureValid: data.signatureValid,
        rawPayload: data.rawPayload,
        order: data.order,
        result: data.result,
        error: data.error,
        processedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    payload.logger.warn(`[webhook] не удалось записать событие ${data.eventId}: ${String(err)}`)
  }
}
