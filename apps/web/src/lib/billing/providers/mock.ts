import crypto from 'crypto'

import type {
  ChargeByTokenInput,
  ChargeResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
  MappedStatus,
  PaymentProvider,
  WebhookParsed,
} from './types'

// Мок-провайдер для локального e2e без боевых ключей (ТЗ §11: тестовые — в dev).
// Подпись зеркалит реальный путь: HMAC-SHA256 по сырому телу в заголовке X-Mock-Sign.

const SECRET = () => process.env.MOCK_WEBHOOK_SECRET || 'mock_dev_secret'

export function mockSign(rawBody: string): string {
  return crypto.createHmac('sha256', SECRET()).update(rawBody).digest('hex')
}

export const mockProvider: PaymentProvider = {
  name: 'mock',

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    const providerInvoiceId = `mock_${input.orderId}_${crypto.randomBytes(6).toString('hex')}`
    // Локальная страница-эмулятор оплаты (M4) отправит вебхук на /webhooks/mock.
    return {
      providerInvoiceId,
      payUrl: `/account/mock-pay/${encodeURIComponent(providerInvoiceId)}`,
    }
  },

  async verifyWebhook({ rawBody, headers }): Promise<boolean> {
    const sign = headers.get('x-mock-sign') ?? ''
    const expected = mockSign(rawBody)
    // timing-safe сравнение одинаковой длины
    if (sign.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(sign), Buffer.from(expected))
  },

  parseWebhook(rawBody: string): WebhookParsed {
    const data = JSON.parse(rawBody) as Record<string, unknown>
    return {
      invoiceId: String(data.invoiceId ?? ''),
      status: String(data.status ?? ''),
      amountMinor: typeof data.amount === 'number' ? data.amount : undefined,
      currency: typeof data.ccy === 'string' ? data.ccy : undefined,
      reference: typeof data.reference === 'string' ? data.reference : undefined,
    }
  },

  mapStatus(providerStatus: string): MappedStatus {
    switch (providerStatus) {
      case 'success':
      case 'hold':
        return 'paid'
      case 'failure':
      case 'expired':
        return 'failed'
      case 'reversed':
        return 'canceled'
      default:
        return 'pending'
    }
  },

  // Детерминированный рекуррент для e2e: токен с подстрокой "fail" → отказ
  // (эмуляция declined card для проверки dunning/past_due), иначе — успех.
  async chargeByToken(input: ChargeByTokenInput): Promise<ChargeResult> {
    if (input.token.includes('fail')) {
      return { ok: false, status: 'failed', error: 'card-declined' }
    }
    return {
      ok: true,
      status: 'paid',
      providerChargeId: `mock_ch_${crypto.randomBytes(6).toString('hex')}`,
    }
  },
}
