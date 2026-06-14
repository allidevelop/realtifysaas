import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { formatPrice } from '@/lib/format'

import { mockPayAction } from '@/app/(account)/billing-actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ invoiceId: string }> }

// Локальная эмуляция платёжной страницы провайдера (только PAYMENTS_PROVIDER=mock).
export default async function MockPayPage({ params }: Props) {
  if ((process.env.PAYMENTS_PROVIDER || 'mock') !== 'mock') notFound()

  const { invoiceId } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const payload = await getPayloadClient()
  const orders = await payload.find({
    collection: 'orders',
    where: { paymentRef: { equals: invoiceId }, user: { equals: user.id } },
    limit: 1,
    overrideAccess: true,
  })
  const order = orders.docs[0]
  if (!order) notFound()

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
          Демо-оплата (mock)
        </div>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">
          {formatPrice((order.totalMinor ?? 0) / 100, order.currency)}
        </h1>
        <p className="mt-1 text-sm text-ink-500">Замовлення {order.orderNumber}</p>

        <div className="mt-6 flex gap-3">
          <form action={mockPayAction} className="flex-1">
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <input type="hidden" name="decision" value="pay" />
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Оплатити
            </button>
          </form>
          <form action={mockPayAction} className="flex-1">
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <input type="hidden" name="decision" value="fail" />
            <button
              type="submit"
              className="w-full rounded-lg bg-ink-100 px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-300/40"
            >
              Відхилити
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-ink-500">
          Це локальна емуляція. Реальна оплата — через Monobank на проді.
        </p>
      </div>
    </div>
  )
}
