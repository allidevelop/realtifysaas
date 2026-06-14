/**
 * Контракты биллинга (ТЗ §11, §12). Зеркалятся Pydantic-схемами в
 * apps/engine/app/schemas/billing.py. Изменение — синхронно + запись в DECISIONS.
 */
import type { Currency } from './index'

export type ModuleKey =
  | 'geoportal'
  | 'arm-analytics'
  | 'express-valuation'
  | 'report-generator'
  | 'interactive-report'
  | 'appraiser-calculator'

export type AccessType = 'quota' | 'period' | 'free'
export type ProviderName = 'mock' | 'monobank' | 'liqpay'
export type ProviderStatus =
  | 'created'
  | 'processing'
  | 'hold'
  | 'success'
  | 'failure'
  | 'reversed'
  | 'expired'
export type MappedStatus = 'paid' | 'pending' | 'failed' | 'canceled'
export type OrderStatus =
  | 'new'
  | 'awaiting_invoice'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'fulfilled'
  | 'canceled'
export type EntitlementStatus = 'active' | 'exhausted' | 'expired' | 'canceled' | 'past_due'
export type PaymentMethod = 'card' | 'invoice'

// ── Платёжный провайдер ─────────────────────────────────────────
export interface CreateInvoiceInput {
  orderId: number | string
  amountMinor: number
  currency: Currency
  reference: string
  description?: string
  redirectUrl: string
  webhookUrl: string
}

export interface CreateInvoiceResult {
  providerInvoiceId: string
  payUrl: string
}

export interface WebhookEvent {
  invoiceId: string
  status: string
  amountMinor?: number
  currency?: string
  reference?: string
}

// ── Документы безнала (engine /api/reports/*) ───────────────────
export interface DocParty {
  name: string
  edrpou?: string
  ipn?: string
  address?: string
  iban?: string
  bankName?: string
  vat?: string
}

export interface DocItem {
  title: string
  qty: number
  priceMinor: number
}

export interface InvoiceDocRequest {
  orderNumber: string
  date: string
  seller: DocParty
  buyer: DocParty
  items: DocItem[]
  totalMinor: number
  currency: Currency
}

export interface ActDocRequest extends InvoiceDocRequest {
  paidDate?: string
}

// ── Представление доступа для кабинета ──────────────────────────
export interface EntitlementView {
  moduleKey: ModuleKey
  accessType: AccessType
  allowed: boolean
  quotaRemaining?: number
  periodEnd?: string | null
}
