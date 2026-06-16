'use client'

import type { FeatureCollection } from 'geojson'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { GeoAccess } from '@/lib/geo/access'
import { formatPrice } from '@/lib/format'

const PriceMap = dynamic(() => import('./PriceMap'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-ink-500">Завантаження карти…</div>
  ),
})

const SEGMENT_LABEL: Record<string, string> = {
  apartment: 'Квартири', house: 'Будинки', commercial: 'Комерція', land: 'Земля',
}
const OP_LABEL: Record<string, string> = { sale: 'Продаж', rent: 'Оренда' }
const METRIC_LABEL: Record<string, string> = {
  avg_price_sqm: 'Середня ціна за м²',
  median_price_sqm: 'Медіанна ціна за м²',
  count: 'Кількість оголошень',
}

export function Geoportal({ access }: { access: GeoAccess }) {
  const [period, setPeriod] = useState(access.allowedPeriods.at(-1) ?? '')
  const [segment, setSegment] = useState('apartment')
  const [operation, setOperation] = useState('sale')
  const [metric, setMetric] = useState('avg_price_sqm')
  const [level, setLevel] = useState(1)
  const [parent, setParent] = useState<number | null>(null)
  const [parentName, setParentName] = useState<string | null>(null)

  const [geojson, setGeojson] = useState<FeatureCollection | null>(null)
  const [values, setValues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Версия загруженных данных: инкремент вместе с setGeojson, служит ключом ремонта
  // слоя карты. КРИТИЧНО: level/parent меняются синхронно (клик), а данные приходят
  // асинхронно — ключ должен меняться по факту прихода данных, иначе react-leaflet
  // не обновит GeoJSON-слой (он реагирует только на смену key).
  const [loadId, setLoadId] = useState(0)

  const formatValue = useCallback(
    (v: number) => (metric === 'count' ? `${Math.round(v)} шт` : `${formatPrice(Math.round(v), 'UAH')}/м²`),
    [metric],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const p = parent ?? ''
        const [uRes, mRes] = await Promise.all([
          fetch(`/account/geoportal/data/units?level=${level}&parent=${p}&simplify=0.01`),
          fetch(
            `/account/geoportal/data/metrics?period=${period}&segment=${segment}&operation=${operation}&metric=${metric}&level=${level}&parent=${p}`,
          ),
        ])
        if (!uRes.ok || !mRes.ok) {
          throw new Error(mRes.status === 403 ? 'Цей період/деталізація доступні за пакетом.' : 'Помилка завантаження.')
        }
        const u = (await uRes.json()) as FeatureCollection
        const m = (await mRes.json()) as { values: Record<string, number> }
        if (!cancelled) {
          setGeojson(u)
          setValues(m.values)
          setLoadId((n) => n + 1)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Помилка')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (period) void load()
    return () => {
      cancelled = true
    }
  }, [level, parent, period, segment, operation, metric])

  const onSelect = useCallback(
    (id: number, name: string, lvl: number) => {
      if (access.canDrill && lvl === 1) {
        setParent(id)
        setParentName(name)
        setLevel(2)
      }
    },
    [access.canDrill],
  )

  const goBack = useCallback(() => {
    setParent(null)
    setParentName(null)
    setLevel(1)
  }, [])

  // Ключ ремонта карты — по версии фактически загруженных данных (не по level/parent,
  // которые меняются раньше прихода данных). + metric, т.к. от него зависит окраска.
  const dataKey = `${loadId}:${metric}`
  const range = useMemo(() => {
    const nums = Object.values(values)
    return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 0 }
  }, [values])

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Панель фильтров */}
      <aside className="w-full shrink-0 space-y-3 rounded-2xl border border-ink-100 bg-white p-4 lg:w-72">
        {level === 2 && (
          <button
            onClick={goBack}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            ← Усі області {parentName ? `(${parentName})` : ''}
          </button>
        )}
        <Field label="Період">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="geo-select">
            {access.allowedPeriods.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Показник">
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="geo-select">
            {access.metrics.map((m) => (
              <option key={m} value={m}>{METRIC_LABEL[m] ?? m}</option>
            ))}
          </select>
        </Field>
        <Field label="Сегмент">
          <select value={segment} onChange={(e) => setSegment(e.target.value)} className="geo-select">
            {access.segments.map((s) => (
              <option key={s} value={s}>{SEGMENT_LABEL[s] ?? s}</option>
            ))}
          </select>
        </Field>
        <Field label="Операція">
          <select value={operation} onChange={(e) => setOperation(e.target.value)} className="geo-select">
            {access.operations.map((o) => (
              <option key={o} value={o}>{OP_LABEL[o] ?? o}</option>
            ))}
          </select>
        </Field>

        {/* Легенда */}
        {range.max > 0 && (
          <div className="pt-2">
            <div className="mb-1 text-xs text-ink-500">{METRIC_LABEL[metric]}</div>
            <div
              className="h-3 w-full rounded"
              style={{ background: 'linear-gradient(to right, #e0ecff, #1b44ad)' }}
            />
            <div className="mt-1 flex justify-between text-xs text-ink-500">
              <span>{formatValue(range.min)}</span>
              <span>{formatValue(range.max)}</span>
            </div>
          </div>
        )}

        {!access.full && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Безкоштовно — лише останній період, без районів. Повний доступ (ретроспектива +
            деталізація) відкривається з будь-яким придбаним пакетом.
          </p>
        )}
        {loading && <p className="text-xs text-ink-500">Завантаження…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </aside>

      {/* Карта */}
      <div className="h-[70vh] w-full overflow-hidden rounded-2xl border border-ink-100 bg-white">
        {geojson && geojson.features.length > 0 ? (
          <PriceMap
            geojson={geojson}
            values={values}
            formatValue={formatValue}
            onSelect={onSelect}
            dataKey={dataKey}
          />
        ) : geojson && !loading && geojson.features.length === 0 ? (
          // Напр., Київ/Севастополь/АР Крим — немає підпорядкованих районів у датасеті.
          <div className="grid h-full place-items-center px-6 text-center text-ink-500">
            <div>
              <p className="font-medium text-ink-700">
                {level === 2
                  ? 'У цій одиниці немає деталізації за районами.'
                  : 'Немає даних для відображення за обраними фільтрами.'}
              </p>
              {level === 2 && (
                <button
                  onClick={goBack}
                  className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  ← Повернутися до областей
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-ink-500">
            {error ?? 'Завантаження…'}
          </div>
        )}
      </div>
    </div>
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
