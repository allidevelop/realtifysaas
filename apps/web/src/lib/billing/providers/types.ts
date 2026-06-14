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

export interface PaymentProvider {
  name: ProviderName
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult>
  verifyWebhook(args: { rawBody: string; headers: Headers }): Promise<boolean>
  parseWebhook(rawBody: string): WebhookParsed
  mapStatus(providerStatus: string): MappedStatus
}
