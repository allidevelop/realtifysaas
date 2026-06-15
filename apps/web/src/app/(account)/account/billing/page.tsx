import Link from 'next/link'

import { buyPackAction, setAutoRenewAction } from '@/app/(account)/billing-actions'
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

const STATUS_LABEL: Record<string, string> = {
  active: 'Активний',
  past_due: 'Прострочено (грейс)',
  exhausted: 'Вичерпано',
  expired: 'Завершено',
  canceled: 'Скасовано',
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>
}) {
  const user = await requireUser('/account/billing')
  const sp = await searchParams
  const payload = await getPayloadClient()

  const [entitlements, groups, ordersRes, ownedOrgRes] = await Promise.all([
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
    payload.find({
      collection: 'organizations',
      where: { owner: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const orders = ordersRes.docs
  const canBuyForOrg = ownedOrgRes.docs.length > 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">Білінг та пакети</h1>

      {sp.ok && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {sp.ok === 'autorenew' ? 'Налаштування авто-продовження збережено.' : 'Готово.'}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {sp.error === 'forbidden'
            ? 'Немає прав на цей доступ.'
            : 'Сталася помилка. Спробуйте ще раз.'}
        </p>
      )}

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
                  <th className="px-4 py-2 font-medium">Авто-продовження</th>
                </tr>
              </thead>
              <tbody>
                {entitlements.map((ent) => (
                  <tr key={ent.id} className="border-t border-ink-100">
                    <td className="px-4 py-2">
                      {typeof ent.module === 'object' ? ent.module.name : '—'}
                      {ent.organization && (
                        <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">
                          організація
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{ent.accessType === 'quota' ? 'Квота' : 'Період'}</td>
                    <td className="px-4 py-2">
                      {ent.accessType === 'quota'
                        ? `${ent.quotaRemaining ?? 0} запитів`
                        : formatDate(ent.periodEnd)}
                    </td>
                    <td className="px-4 py-2">{STATUS_LABEL[ent.status] ?? ent.status}</td>
                    <td className="px-4 py-2">
                      {ent.accessType === 'period' ? (
                        <form action={setAutoRenewAction} className="flex items-center gap-2">
                          <input type="hidden" name="entitlementId" value={ent.id} />
                          <input
                            type="hidden"
                            name="enable"
                            value={ent.autoRenew ? 'off' : 'on'}
                          />
                          <span className={ent.autoRenew ? 'text-emerald-600' : 'text-ink-400'}>
                            {ent.autoRenew ? 'увімкнено' : 'вимкнено'}
                          </span>
                          <button
                            type="submit"
                            className="rounded border border-ink-100 px-2 py-1 text-xs text-ink-700 hover:bg-ink-100/40"
                          >
                            {ent.autoRenew ? 'Вимкнути' : 'Увімкнути'}
                          </button>
                        </form>
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
                <PackBuyCard key={pack.id} pack={pack} canBuyForOrg={canBuyForOrg} />
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
