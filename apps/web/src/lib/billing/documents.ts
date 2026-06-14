import type { Order } from '@/payload-types'

// Генерация PDF счёта/акта через engine (ТЗ §11). Web строит запрос из заказа,
// engine рендерит PDF; выдача — через защищённый роут кабинета.

const ENGINE = () => process.env.ENGINE_BASE_URL || 'http://localhost:8000'

function ddmmyyyy(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

function buildDocRequest(order: Order, kind: 'invoice' | 'act') {
  const le = order.legalEntity
  return {
    orderNumber: order.orderNumber ?? String(order.id),
    date: ddmmyyyy(order.createdAt),
    seller: {
      name: process.env.SELLER_NAME || 'Realtify',
      edrpou: process.env.SELLER_EDRPOU || '',
      iban: process.env.SELLER_IBAN || '',
      vat: process.env.SELLER_VAT || '',
    },
    buyer: {
      name: le?.name || order.customerName || order.email || 'Покупець',
      edrpou: le?.edrpou || '',
      ipn: le?.ipn || '',
      address: order.billingAddress || '',
    },
    items: (order.items ?? []).map((it) => ({
      title: it.titleSnapshot || 'Послуга',
      qty: it.qty ?? 1,
      priceMinor: it.priceMinorSnapshot,
    })),
    totalMinor: order.totalMinor,
    currency: order.currency,
    ...(kind === 'act' ? { paidDate: ddmmyyyy(order.paidAt) } : {}),
  }
}

export async function generateOrderDoc(order: Order, kind: 'invoice' | 'act'): Promise<Buffer> {
  const res = await fetch(`${ENGINE()}/api/reports/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildDocRequest(order, kind)),
  })
  if (!res.ok) {
    throw new Error(`engine ${kind} HTTP ${res.status}: ${await res.text()}`)
  }
  return Buffer.from(await res.arrayBuffer())
}
