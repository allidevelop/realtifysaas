import Link from 'next/link'

import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ order?: string }> }

const STATUS_TEXT: Record<string, { title: string; cls: string; note: string }> = {
  fulfilled: { title: 'Оплата успішна', cls: 'text-green-700', note: 'Доступ відкрито. Перейдіть до кабінету.' },
  paid: { title: 'Оплата отримана', cls: 'text-green-700', note: 'Доступ активується за кілька секунд.' },
  pending: { title: 'Очікуємо оплату', cls: 'text-amber-700', note: 'Якщо ви оплатили — оновіть сторінку.' },
  failed: { title: 'Оплату відхилено', cls: 'text-red-700', note: 'Спробуйте ще раз.' },
  canceled: { title: 'Платіж скасовано', cls: 'text-red-700', note: 'Спробуйте ще раз.' },
}

export default async function BillingReturnPage({ searchParams }: Props) {
  const sp = await searchParams
  const user = await getCurrentUser()
  const orderId = Number(sp.order)

  let status = 'pending'
  if (user && Number.isFinite(orderId)) {
    const payload = await getPayloadClient()
    const orders = await payload.find({
      collection: 'orders',
      where: { id: { equals: orderId }, user: { equals: user.id } },
      limit: 1,
      overrideAccess: true,
    })
    if (orders.docs[0]) status = orders.docs[0].status
  }
  const view = STATUS_TEXT[status] ?? STATUS_TEXT.pending

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
        <h1 className={`text-2xl font-bold ${view.cls}`}>{view.title}</h1>
        <p className="mt-2 text-sm text-ink-500">{view.note}</p>
        <Link
          href="/account"
          className="mt-6 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          До кабінету
        </Link>
      </div>
    </div>
  )
}
