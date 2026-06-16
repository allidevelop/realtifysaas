'use client'

import type { FeatureCollection } from 'geojson'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ColorScale } from './PriceMap'
import { Select } from '@/components/ui/Select'
import { formatPrice } from '@/lib/format'
import type { GeoAccess } from '@/lib/geo/access'

const PriceMap = dynamic(() => import('./PriceMap'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-ink-500">Завантаження карти…</div>
  ),
})

type Lang = 'uk' | 'en'

// Локальный i18n геопортала (укр/англ). Названия АТЕ остаются из данных (украинские).
const T: Record<Lang, Record<string, string>> = {
  uk: {
    period: 'Період', metric: 'Показник', segment: 'Сегмент', operation: 'Операція',
    currency: 'Валюта', back: '← Усі області', backToOblasts: '← Повернутися до областей',
    noRaions: 'У цій одиниці немає деталізації за районами.',
    noData: 'Немає даних для відображення за обраними фільтрами.',
    loading: 'Завантаження…', search: 'Пошук області / району…', exportPdf: 'Експорт PDF',
    units: 'шт', noDataLegend: 'немає даних', oblast: 'область', raion: 'район',
    freemium:
      'Безкоштовно — лише останній період, без районів. Повний доступ (ретроспектива + ' +
      'деталізація) відкривається з будь-яким придбаним пакетом.',
  },
  en: {
    period: 'Period', metric: 'Metric', segment: 'Segment', operation: 'Operation',
    currency: 'Currency', back: '← All regions', backToOblasts: '← Back to regions',
    noRaions: 'This unit has no district-level detail.',
    noData: 'No data to display for the selected filters.',
    loading: 'Loading…', search: 'Search region / district…', exportPdf: 'Export PDF',
    units: 'pcs', noDataLegend: 'no data', oblast: 'region', raion: 'district',
    freemium:
      'Free — latest period only, no districts. Full access (history + drill-down) ' +
      'unlocks with any purchased package.',
  },
}

const SEG: Record<Lang, Record<string, string>> = {
  uk: { apartment: 'Квартири', house: 'Будинки', commercial: 'Комерція', land: 'Земля' },
  en: { apartment: 'Apartments', house: 'Houses', commercial: 'Commercial', land: 'Land' },
}
const OPS: Record<Lang, Record<string, string>> = {
  uk: { sale: 'Продаж', rent: 'Оренда' },
  en: { sale: 'Sale', rent: 'Rent' },
}
const MET: Record<Lang, Record<string, string>> = {
  uk: {
    avg_price_sqm: 'Середня ціна за м²', median_price_sqm: 'Медіанна ціна за м²',
    count: 'Кількість оголошень',
  },
  en: {
    avg_price_sqm: 'Avg price per m²', median_price_sqm: 'Median price per m²',
    count: 'Listings count',
  },
}

const PRICE_METRICS = ['avg_price_sqm', 'median_price_sqm']
const COLORS5 = ['#d2f1df', '#9fe0bd', '#5fc295', '#1b8f60', '#0a6141']

// Квантильные пороги (20/40/60/80%) → 5 классов. Дубли (мало уникальных значений) убираем.
function computeScale(values: number[]): ColorScale {
  const nums = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (nums.length === 0) return { thresholds: [], colors: COLORS5 }
  const q = (p: number) => nums[Math.min(nums.length - 1, Math.floor(p * nums.length))]
  const thresholds: number[] = []
  for (const t of [q(0.2), q(0.4), q(0.6), q(0.8)]) {
    if (thresholds.length === 0 || t > thresholds[thresholds.length - 1]) thresholds.push(t)
  }
  return { thresholds, colors: COLORS5 }
}

interface SearchItem { id: number; name: string; level: number; parentId: number | null }

export function Geoportal({ access }: { access: GeoAccess }) {
  const [lang, setLang] = useState<Lang>('uk')
  const [currency, setCurrency] = useState<'UAH' | 'USD'>('UAH')
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

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchItem[]>([])

  const tr = T[lang]
  const isPrice = PRICE_METRICS.includes(metric)

  const formatValue = useCallback(
    (v: number) => {
      if (metric === 'count') return `${Math.round(v)} ${T[lang].units}`
      if (currency === 'USD' && access.usdRate) {
        return `${formatPrice(Math.round(v / access.usdRate), 'USD')}/м²`
      }
      return `${formatPrice(Math.round(v), 'UAH')}/м²`
    },
    [metric, currency, access.usdRate, lang],
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

  // Поиск АТЕ по названию (только при полном доступе — drill-down доступен за пакетом).
  useEffect(() => {
    if (!access.canDrill) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let cancel = false
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/account/geoportal/data/search?q=${encodeURIComponent(q)}`)
        if (!r.ok) return
        const d = (await r.json()) as { items: SearchItem[] }
        if (!cancel) setResults(d.items.slice(0, 8))
      } catch {
        /* игнор сетевых ошибок поиска */
      }
    }, 250)
    return () => {
      cancel = true
      clearTimeout(id)
    }
  }, [query, access.canDrill])

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

  // Выбор в поиске → провалиться в нужную область (для района — в его область).
  const onSearchSelect = (item: SearchItem) => {
    const oblastId = item.level === 1 ? item.id : item.parentId
    if (oblastId == null) return
    setParent(oblastId)
    setParentName(item.level === 1 ? item.name : null)
    setLevel(2)
    setQuery('')
    setResults([])
  }

  const goBack = useCallback(() => {
    setParent(null)
    setParentName(null)
    setLevel(1)
  }, [])

  // Ключ ремонта карты — по версии фактически загруженных данных (+ metric/currency/lang,
  // от которых зависит окраска и подписи тултипов).
  const dataKey = `${loadId}:${metric}:${currency}:${lang}`
  const range = useMemo(() => {
    const nums = Object.values(values)
    return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 0 }
  }, [values])
  const scale = useMemo(() => computeScale(Object.values(values)), [values])

  // Строки легенды: 5 классов (диапазоны в выбранной валюте).
  const legendRows = useMemo(() => {
    if (range.max <= 0) return []
    const edges = [range.min, ...scale.thresholds, range.max]
    const rows: { color: string; label: string }[] = []
    for (let i = 0; i < edges.length - 1; i++) {
      rows.push({
        color: scale.colors[Math.min(i, scale.colors.length - 1)],
        label: `${formatValue(edges[i])} – ${formatValue(edges[i + 1])}`,
      })
    }
    return rows
  }, [scale, range, formatValue])

  const reportHref =
    `/account/geoportal/data/report?period=${period}&segment=${segment}` +
    `&operation=${operation}&metric=${metric}&level=${level}&parent=${parent ?? ''}&currency=${currency}`

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Панель фильтров */}
      <aside className="w-full shrink-0 space-y-3 rounded-2xl border border-ink-100 bg-white p-4 lg:w-72">
        {/* Язык интерфейса */}
        <div className="flex items-center justify-end gap-1 text-xs">
          {(['uk', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded px-2 py-0.5 font-medium uppercase ${
                lang === l ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Поиск по карте */}
        {access.canDrill && (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr.search}
              className="geo-select w-full"
            />
            {results.length > 0 && (
              <ul className="absolute z-[1000] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-ink-100 bg-white shadow-lg">
                {results.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => onSearchSelect(it)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                    >
                      {it.name}
                      <span className="ml-1 text-xs text-ink-400">
                        {it.level === 1 ? tr.oblast : tr.raion}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {level === 2 && (
          <button
            onClick={goBack}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {tr.back} {parentName ? `(${parentName})` : ''}
          </button>
        )}

        <Field label={tr.period}>
          <Select
            value={period}
            onChange={setPeriod}
            options={access.allowedPeriods.map((p) => ({ value: p, label: p }))}
          />
        </Field>
        <Field label={tr.metric}>
          <Select
            value={metric}
            onChange={setMetric}
            options={access.metrics.map((m) => ({ value: m, label: MET[lang][m] ?? m }))}
          />
        </Field>
        <Field label={tr.segment}>
          <Select
            value={segment}
            onChange={setSegment}
            options={access.segments.map((s) => ({ value: s, label: SEG[lang][s] ?? s }))}
          />
        </Field>
        <Field label={tr.operation}>
          <Select
            value={operation}
            onChange={setOperation}
            options={access.operations.map((o) => ({ value: o, label: OPS[lang][o] ?? o }))}
          />
        </Field>

        {/* Валюта — только для ценовых показателей */}
        {isPrice && (
          <Field label={tr.currency}>
            <div className="flex gap-1">
              {(['UAH', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
                    currency === c
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-ink-100 text-ink-500 hover:bg-ink-50'
                  }`}
                >
                  {c === 'UAH' ? '₴ UAH' : '$ USD'}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* Легенда — 5 классов */}
        {legendRows.length > 0 && (
          <div className="pt-1">
            <div className="mb-1 text-xs text-ink-500">{MET[lang][metric]}</div>
            <ul className="space-y-1">
              {legendRows.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-ink-600">
                  <span className="h-3 w-4 shrink-0 rounded-sm" style={{ background: r.color }} />
                  {r.label}
                </li>
              ))}
              <li className="flex items-center gap-2 text-xs text-ink-400">
                <span className="h-3 w-4 shrink-0 rounded-sm" style={{ background: '#e5e7eb' }} />
                {tr.noDataLegend}
              </li>
            </ul>
          </div>
        )}

        {access.full && (
          <a
            href={reportHref}
            className="block rounded-lg border border-brand-600 px-3 py-2 text-center text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            {tr.exportPdf}
          </a>
        )}

        {!access.full && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{tr.freemium}</p>
        )}
        {loading && <p className="text-xs text-ink-500">{tr.loading}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </aside>

      {/* Карта — на весь доступный экран */}
      <div className="h-[calc(100vh-11rem)] min-h-[520px] w-full overflow-hidden rounded-2xl border border-ink-100 bg-white">
        {geojson && geojson.features.length > 0 ? (
          <PriceMap
            geojson={geojson}
            values={values}
            formatValue={formatValue}
            onSelect={onSelect}
            scale={scale}
            dataKey={dataKey}
          />
        ) : geojson && !loading && geojson.features.length === 0 ? (
          // Напр., Київ/Севастополь/АР Крим — немає підпорядкованих районів у датасеті.
          <div className="grid h-full place-items-center px-6 text-center text-ink-500">
            <div>
              <p className="font-medium text-ink-700">{level === 2 ? tr.noRaions : tr.noData}</p>
              {level === 2 && (
                <button
                  onClick={goBack}
                  className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {tr.backToOblasts}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-ink-500">{error ?? tr.loading}</div>
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
