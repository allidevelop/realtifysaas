import crypto from 'crypto'

import { getRedis } from '../redis'
import type {
  CreateInvoiceInput,
  CreateInvoiceResult,
  MappedStatus,
  PaymentProvider,
  WebhookParsed,
} from './types'

// Адаптер Monobank Acquiring (ТЗ §11). Создание счёта + проверка вебхука по
// ECDSA-подписи (X-Sign) против публичного ключа мерчанта (кэш в Redis 24h).

const API_BASE = () => process.env.MONOBANK_API_BASE || 'https://api.monobank.ua'
const TOKEN = () => process.env.MONOBANK_TOKEN || ''

const CCY_NUM: Record<string, number> = { UAH: 980, USD: 840, EUR: 978 }
const CCY_STR: Record<number, string> = { 980: 'UAH', 840: 'USD', 978: 'EUR' }

async function getPubKeyDer(): Promise<Buffer> {
  const redis = getRedis()
  const cached = await redis.get('monobank:pubkey')
  if (cached) return Buffer.from(cached, 'base64')
  const res = await fetch(`${API_BASE()}/api/merchant/pubkey`, {
    headers: { 'X-Token': TOKEN() },
  })
  if (!res.ok) throw new Error(`monobank pubkey HTTP ${res.status}`)
  const json = (await res.json()) as { key: string }
  await redis.set('monobank:pubkey', json.key, 'EX', 86_400)
  return Buffer.from(json.key, 'base64')
}

export const monobankProvider: PaymentProvider = {
  name: 'monobank',

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    const body = {
      amount: input.amountMinor,
      ccy: CCY_NUM[input.currency] ?? 980,
      merchantPaymInfo: {
        reference: input.reference,
        destination: input.description ?? input.reference,
      },
      redirectUrl: input.redirectUrl,
      webHookUrl: input.webhookUrl,
      validity: 3600,
    }
    const res = await fetch(`${API_BASE()}/api/merchant/invoice/create`, {
      method: 'POST',
      headers: { 'X-Token': TOKEN(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`monobank invoice/create HTTP ${res.status}: ${await res.text()}`)
    }
    const json = (await res.json()) as { invoiceId: string; pageUrl: string }
    return { providerInvoiceId: json.invoiceId, payUrl: json.pageUrl }
  },

  async verifyWebhook({ rawBody, headers }): Promise<boolean> {
    const sign = headers.get('x-sign')
    if (!sign) return false
    try {
      const der = await getPubKeyDer()
      const pub = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' })
      return crypto.verify('sha256', Buffer.from(rawBody), pub, Buffer.from(sign, 'base64'))
    } catch {
      return false
    }
  },

  parseWebhook(rawBody: string): WebhookParsed {
    const d = JSON.parse(rawBody) as Record<string, unknown>
    return {
      invoiceId: String(d.invoiceId ?? ''),
      status: String(d.status ?? ''),
      amountMinor: typeof d.amount === 'number' ? d.amount : undefined,
      currency: typeof d.ccy === 'number' ? CCY_STR[d.ccy] : undefined,
      reference: typeof d.reference === 'string' ? d.reference : undefined,
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
}
