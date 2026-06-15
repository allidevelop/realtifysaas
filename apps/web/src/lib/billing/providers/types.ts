// Провайдер-агностик интерфейс оплаты (ТЗ §11). Конкретные адаптеры — mock, monobank.

export type ProviderName = 'mock' | 'monobank' | 'liqpay'

// Нормализованный платёжный статус после маппинга провайдерского статуса.
export type MappedStatus = 'paid' | 'pending' | 'failed' | 'canceled'

export interface CreateInvoiceInput {
  orderId: number | string
  amountMinor: number
  currency: string
  reference: string
  description?: string
  redirectUrl: string
  webhookUrl: string
}

export interface CreateInvoiceResult {
  providerInvoiceId: string
  payUrl: string
}

export interface WebhookParsed {
  invoiceId: string
  status: string
  amountMinor?: number
  currency?: string
  reference?: string
}

// Рекуррентное списание по сохранённому токену карты (wallet) — ТЗ §11 (авто-продление).
export interface ChargeByTokenInput {
  token: string
  amountMinor: number
  currency: string
  reference: string
  description?: string
}

export interface ChargeResult {
  ok: boolean
  status: MappedStatus
  providerChargeId?: string
  error?: string
}

export interface PaymentProvider {
  name: ProviderName
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult>
  verifyWebhook(args: { rawBody: string; headers: Headers }): Promise<boolean>
  parseWebhook(rawBody: string): WebhookParsed
  mapStatus(providerStatus: string): MappedStatus
  // Опционально: списание по токену (рекуррент). Не все провайдеры/режимы поддерживают.
  chargeByToken?(input: ChargeByTokenInput): Promise<ChargeResult>
}
