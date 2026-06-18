'use client'

import { useActionState, useState } from 'react'

import { runValuation, type ValuationState } from '@/app/(account)/account/valuation-actions'
import { formatPrice, quotaLabel } from '@/lib/format'

import { UnitCombobox } from './UnitCombobox'

export interface UnitOption {
  id: number
  name: string
  parentName: string | null
}

interface Props {
  moduleKey: string
  mode: 'express' | 'detailed'
  units: UnitOption[]
  quotaRemaining: number
}

function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function ValuationModule({ moduleKey, mode, units, quotaRemaining }: Props) {
  const [state, action, pending] = useActionState<ValuationState, FormData>(runValuation, {})
  // Свежий runId на каждый рендер (идемпотентность двойного сабмита до завершения).
  const runId = uuid()
  // Режим верификации (Калькулятор оцінювача): сверка заявленной стоимости с оценкой.
  const [declared, setDeclared] = useState('')

  const r = state.result
  const ok = r && r.comparablesCount > 0

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Форма */}
      <form action={action} className="space-y-3 rounded-2xl border border-ink-100 bg-surface p-6">
        <input type="hidden" name="module" value={moduleKey} />
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="runId" value={runId} />

        <Field label="Територіальна одиниця (район)">
          <UnitCombobox units={units} name="adminUnitId" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Сегмент">
            <select name="segment" className="geo-select" defaultValue="apartment">
              <option value="apartment">Квартира</option>
              <option value="house">Будинок</option>
              <option value="commercial">Комерція</option>
              <option value="land">Земля</option>
            </select>
          </Field>
          <Field label="Операція">
            <select name="operation" className="geo-select" defaultValue="sale">
              <option value="sale">Продаж</option>
              <option value="rent">Оренда</option>
            </select>
          </Field>
        </div>
        <Field label="Площа, м²">
          <input name="area" type="number" min={1} step="0.1" required defaultValue={65} className="geo-select" />
        </Field>
        {mode === 'detailed' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Поверх">
                <input name="floor" type="number" min={1} className="geo-select" />
              </Field>
              <Field label="Поверхів усього">
                <input name="totalFloors" type="number" min={1} className="geo-select" />
              </Field>
            </div>
            <Field label="Заявлена вартість, грн (верифікація — опц.)">
              <input
                type="number"
                min={0}
                value={declared}
                onChange={(e) => setDeclared(e.target.value)}
                placeholder="напр. 2 500 000"
                className="geo-select"
              />
            </Field>
          </>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Розрахунок…' : 'Оцінити (−1 запит)'}
        </button>
        <p className="text-center text-xs text-ink-500">Залишок квоти: {quotaLabel(quotaRemaining)}</p>
      </form>

      {/* Результат */}
      <div className="rounded-2xl border border-ink-100 bg-surface p-6">
        {state.error && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {state.error === 'quota-exhausted'
              ? 'Квоту вичерпано — придбайте пакет.'
              : state.error === 'invalid-input'
                ? 'Заповніть район і площу.'
                : 'Не вдалося виконати оцінку.'}
          </p>
        )}

        {!state.error && !r && (
          <p className="text-ink-500">Заповніть параметри ліворуч і натисніть «Оцінити».</p>
        )}

        {r && !ok && (
          <p className="text-ink-500">Недостатньо аналогів для цих параметрів. Спробуйте інший район/сегмент.</p>
        )}

        {ok && (
          <div>
            <div className="text-sm text-ink-500">Орієнтовна вартість{r.adminUnitName ? ` · ${r.adminUnitName}` : ''}</div>
            <div className="mt-1 text-4xl font-bold text-ink-900">
              {formatPrice(r.value, 'UAH')}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <Badge confidence={r.confidence} />
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-700">
                Аналогів: {r.comparablesCount}
              </span>
              {r.pricePerSqm > 0 && (
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-700">
                  {formatPrice(r.pricePerSqm, 'UAH')}/м²
                </span>
              )}
            </div>

            {mode === 'detailed' &&
              (() => {
                const dv = Number(declared)
                if (!dv || dv <= 0 || !r.value) return null
                const dev = (dv / r.value - 1) * 100
                const within = Math.abs(dev) <= 10
                const cls = within
                  ? 'bg-emerald-50 text-emerald-700'
                  : Math.abs(dev) <= 20
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
                const verdict = within ? 'Підтверджено' : dev > 0 ? 'Завищено' : 'Занижено'
                return (
                  <div className={`mt-5 rounded-lg px-4 py-3 text-sm ${cls}`}>
                    <div className="font-semibold">Верифікація вартості: {verdict}</div>
                    <div className="mt-1">
                      Заявлено {formatPrice(dv, 'UAH')} проти оцінки {formatPrice(r.value, 'UAH')} —
                      відхилення {dev >= 0 ? '+' : ''}
                      {dev.toFixed(1)}%.
                    </div>
                  </div>
                )
              })()}

            {mode === 'detailed' && (
              <>
                {r.adjustments.length > 0 && (
                  <div className="mt-5">
                    <div className="text-sm font-semibold text-ink-900">Корективи</div>
                    <ul className="mt-1 text-sm text-ink-600">
                      {r.adjustments.map((a) => (
                        <li key={a.factor}>
                          {a.description}: ×{a.coefficient}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.comparables.length > 0 && (
                  <div className="mt-5">
                    <div className="text-sm font-semibold text-ink-900">Аналоги (топ за схожістю)</div>
                    <div className="mt-2 overflow-hidden rounded-lg border border-ink-100">
                      <table className="w-full text-sm">
                        <thead className="bg-ink-100/40 text-left text-ink-500">
                          <tr>
                            <th className="px-3 py-1.5 font-medium">Площа</th>
                            <th className="px-3 py-1.5 font-medium">Ціна</th>
                            <th className="px-3 py-1.5 font-medium">за м²</th>
                            <th className="px-3 py-1.5 font-medium">Вага</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.comparables.map((c) => (
                            <tr key={c.id} className="border-t border-ink-100">
                              <td className="px-3 py-1.5">{c.area} м²</td>
                              <td className="px-3 py-1.5">{formatPrice(c.price, 'UAH')}</td>
                              <td className="px-3 py-1.5">{formatPrice(c.pricePerSqm, 'UAH')}</td>
                              <td className="px-3 py-1.5">{c.weight}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {r.methodology && (
                  <p className="mt-5 text-xs text-ink-500">{r.methodology}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Badge({ confidence }: { confidence: number }) {
  const cls =
    confidence >= 0.7
      ? 'bg-green-50 text-green-700'
      : confidence >= 0.4
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700'
  return (
    <span className={`rounded-full px-2.5 py-1 ${cls}`}>
      Довіра: {Math.round(confidence * 100)}%
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink-700">{label}</span>
      {children}
    </label>
  )
}
