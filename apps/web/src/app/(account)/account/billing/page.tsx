import Link from 'next/link'

import { buyPackAction } from '@/app/(account)/billing-actions'
import { PackBuyCard } from '@/components/account/PackBuyCard'
import { requireUser } from '@/lib/auth'
import { getPacksGroupedByModule } from '@/lib/billing/catalog'
import { getUserEntitlements } from '@/lib/billing/entitlements'
import { formatDate, formatPrice } from '@/lib/format'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

const ORDER_STATUS: Record<string, string> = {
  new: 'Новий',
  awaiting_invoice: 'Очікує оплату за рахунком',
  pending: 'Очікує оплату',
  paid: 'Оплачено',
  failed: 'Помилка',
  fulfilled: 'Виконано',
  canceled: 'Скасовано',
}

export default async function BillingPage() {
  const user = await requireUser('/account/billing')
  const payload = await getPayloadClient()

  const [entitlements, groups, ordersRes] = await Promise.all([
    getUserEntitlements(user),
    getPacksGroupedByModule(),
    payload.find({
      collection: 'orders',
      where: { user: { equals: user.id } },
      sort: '-createdAt',
      depth: 0,
      limit: 50,
      overrideAccess: true,
    }),
  ])
  const orders = ordersRes.docs

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">Білінг та пакети</h1>

      {/* Активные доступы */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink-900">Ваші доступи</h2>
        {entitlements.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Активних доступів немає. Придбайте пакет нижче.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/40 text-left text-ink-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Модуль</th>
                  <th className="px-4 py-2 font-medium">Тип</th>
                  <th className="px-4 py-2 font-medium">Залишок / до</th>
                  <th className="px-4 py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {entitlements.map((ent) => (
                  <tr key={ent.id} className="border-t border-ink-100">
                    <td className="px-4 py-2">
                      {typeof ent.module === 'object' ? ent.module.name : '—'}
                    </td>
                    <td className="px-4 py-2">{ent.accessType === 'quota' ? 'Квота' : 'Період'}</td>
                    <td className="px-4 py-2">
                      {ent.accessType === 'quota'
                        ? `${ent.quotaRemaining ?? 0} запитів`
                        : formatDate(ent.periodEnd)}
                    </td>
                    <td className="px-4 py-2">{ent.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* История заказов */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink-900">Історія замовлень</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Замовлень ще немає.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/40 text-left text-ink-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Замовлення</th>
                  <th className="px-4 py-2 font-medium">Сума</th>
                  <th className="px-4 py-2 font-medium">Статус</th>
                  <th className="px-4 py-2 font-medium">Документи</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-ink-100">
                    <td className="px-4 py-2">{o.orderNumber}</td>
                    <td className="px-4 py-2">
                      {formatPrice((o.totalMinor ?? 0) / 100, o.currency)}
                    </td>
                    <td className="px-4 py-2">{ORDER_STATUS[o.status] ?? o.status}</td>
                    <td className="px-4 py-2">
                      {o.paymentMethod === 'invoice' ? (
                        <span className="flex gap-3">
                          <Link className="text-brand-600" href={`/account/orders/${o.id}/invoice`}>
                            Рахунок
                          </Link>
                          {(o.status === 'paid' || o.status === 'fulfilled') && (
                            <Link className="text-brand-600" href={`/account/orders/${o.id}/act`}>
                              Акт
                            </Link>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Покупка пакетов по модулям */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink-900">Придбати пакети</h2>
        {groups.map((g) => (
          <div key={g.moduleKey} className="mt-6">
            <h3 className="text-base font-semibold text-brand-700">{g.module.name}</h3>
            <div className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {g.packs.map((pack) => (
                <PackBuyCard key={pack.id} pack={pack} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Безнал для юрлиц */}
      <section className="mt-12 rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="text-lg font-semibold text-ink-900">Оплата за рахунком (юрособи, банки)</h2>
        <p className="mt-1 text-sm text-ink-500">
          Оформте замовлення з реквізитами — згенеруємо рахунок-фактуру (PDF), після оплати —
          акт. Доступ активується після підтвердження оплати.
        </p>
        <form action={buyPackAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="paymentMethod" value="invoice" />
          <label className="text-sm">
            Пакет
            <select
              name="packId"
              required
              className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
            >
              {groups.flatMap((g) =>
                g.packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {g.module.name}: {p.name} — {formatPrice(p.price, p.currency)}
                  </option>
                )),
              )}
            </select>
          </label>
          <label className="text-sm">
            Назва юрособи
            <input name="le_name" required className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            ЄДРПОУ
            <input name="le_edrpou" className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            ІПН
            <input name="le_ipn" className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-700"
            >
              Сформувати рахунок
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
