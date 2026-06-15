'use client'

import { useActionState } from 'react'

import { type BatchState, runBatch } from '@/app/(account)/account/portfolio-actions'
import { formatPrice } from '@/lib/format'

import { UnitCombobox } from './UnitCombobox'
import type { UnitOption } from './ValuationModule'

function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function PortfolioModule({ units, quota }: { units: UnitOption[]; quota: number }) {
  const [state, action, pending] = useActionState<BatchState, FormData>(runBatch, {})
  const runId = uuid()
  const r = state.result

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
      <form action={action} className="space-y-3 rounded-2xl border border-ink-100 bg-white p-6">
        <input type="hidden" name="runId" value={runId} />
        <p className="rounded-lg bg-ink-100/40 px-3 py-2 text-xs text-ink-600">
          Пакетна оцінка масиву об’єктів однією вибіркою. Введіть перелік (по рядку на об’єкт):
          <code className="mx-1">назва;площа</code> або просто <code>площа</code>.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Територіальна одиниця (район)</span>
          <UnitCombobox units={units} name="adminUnitId" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Сегмент</span>
            <select name="segment" className="geo-select" defaultValue="apartment">
              <option value="apartment">Квартира</option>
              <option value="house">Будинок</option>
              <option value="commercial">Комерція</option>
              <option value="land">Земля</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Операція</span>
            <select name="operation" className="geo-select" defaultValue="sale">
              <option value="sale">Продаж</option>
              <option value="rent">Оренда</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Перелік об’єктів</span>
          <textarea
            name="objects"
            rows={7}
            required
            defaultValue={'Квартира А;62\nКвартира Б;78\n45\n90'}
            className="geo-select font-mono text-xs"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Оцінювання…' : 'Оцінити портфель (−1 запит)'}
        </button>
        <p className="text-center text-xs text-ink-500">Залишок квоти: {quota}</p>
      </form>

      <div className="rounded-2xl border border-ink-100 bg-white p-6">
        {state.error && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {state.error === 'quota'
              ? 'Квоту вичерпано — придбайте пакет.'
              : state.error === 'invalid'
                ? 'Оберіть район і введіть хоча б один об’єкт із площею.'
                : 'Не вдалося виконати оцінку.'}
          </p>
        )}
        {!state.error && !r && <p className="text-ink-500">Введіть перелік об’єктів ліворуч.</p>}
        {r && (
          <div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-700">
                Об’єктів: {r.count}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                Оцінено: {r.valued}
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">
                Сумарна вартість: {formatPrice(r.total, 'UAH')}
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-ink-100">
              <table className="w-full text-sm">
                <thead className="bg-ink-100/40 text-left text-ink-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Об’єкт</th>
                    <th className="px-3 py-2 font-medium">Вартість</th>
                    <th className="px-3 py-2 font-medium">Ціна/м²</th>
                    <th className="px-3 py-2 font-medium">Довіра</th>
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((it, i) => (
                    <tr key={i} className="border-t border-ink-100">
                      <td className="px-3 py-2">{it.label}</td>
                      <td className="px-3 py-2">
                        {it.comparablesCount > 0 ? formatPrice(it.value, 'UAH') : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {it.comparablesCount > 0 ? formatPrice(it.pricePerSqm, 'UAH') : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {it.comparablesCount > 0 ? `${Math.round(it.confidence * 100)}%` : 'нема аналогів'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
