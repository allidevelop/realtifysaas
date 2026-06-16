'use client'

import { useRef, useState } from 'react'

import type { Listing, ListingsResult, ListingsStats } from '@/lib/analytics/engine'
import { formatPrice } from '@/lib/format'

interface UnitOption {
  id: number
  name: string
  parentName: string | null
}

function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const SEG_LABEL: Record<string, string> = {
  apartment: 'Квартири', house: 'Будинки', commercial: 'Комерція', land: 'Земля',
}

export function ListingsSearch({ units, quota }: { units: UnitOption[]; quota: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [items, setItems] = useState<Listing[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [stats, setStats] = useState<ListingsStats | null>(null)
  const [sort, setSort] = useState('published_desc')
  const [loading, setLoading] = useState(false)

  const grouped = new Map<string, UnitOption[]>()
  for (const u of units) {
    const k = u.parentName ?? '—'
    if (!grouped.has(k)) grouped.set(k, [])
    grouped.get(k)!.push(u)
  }

  async function search(nextSort?: string) {
    if (!formRef.current) return
    const useSort = nextSort ?? sort
    setLoading(true)
    const fd = new FormData(formRef.current)
    const sp = new URLSearchParams()
    for (const k of ['adminUnitId', 'segment', 'operation', 'source', 'areaMin', 'areaMax', 'priceMin', 'priceMax']) {
      const v = fd.get(k)
      if (v) sp.set(k, String(v))
    }
    sp.set('sort', useSort)
    try {
      const res = await fetch(`/account/arm-analytics/data/search?${sp.toString()}`)
      const d = (await res.json()) as ListingsResult
      setItems(d.items ?? [])
      setTotal(d.total ?? 0)
      setStats(d.stats ?? null)
    } finally {
      setLoading(false)
    }
  }

  function sortBy(col: string) {
    const next = sort === `${col}_desc` ? `${col}_asc` : `${col}_desc`
    setSort(next)
    void search(next)
  }

  const fmt = (v: number | null | undefined) => (v != null ? formatPrice(v, 'UAH') : '—')

  function Th({ col, label }: { col?: string; label: string }) {
    if (!col) return <th className="px-3 py-2 font-medium">{label}</th>
    const active = sort.startsWith(`${col}_`)
    const arrow = !active ? '' : sort.endsWith('_asc') ? ' ▲' : ' ▼'
    return (
      <th
        className="cursor-pointer select-none px-3 py-2 font-medium hover:text-ink-700"
        onClick={() => sortBy(col)}
      >
        {label}
        {arrow}
      </th>
    )
  }

  return (
    <div className="mt-6">
      <form
        ref={formRef}
        action="/account/arm-analytics/export"
        method="POST"
        className="space-y-3 rounded-2xl border border-ink-100 bg-white p-5"
      >
        <input type="hidden" name="runId" value={uuid()} />
        <input type="hidden" name="sort" value={sort} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Район</span>
            <select name="adminUnitId" className="geo-select">
              <option value="">усі</option>
              {[...grouped.entries()].map(([p, list]) => (
                <optgroup key={p} label={p}>
                  {list.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Сегмент</span>
            <select name="segment" className="geo-select">
              <option value="">усі</option>
              <option value="apartment">Квартири</option>
              <option value="house">Будинки</option>
              <option value="commercial">Комерція</option>
              <option value="land">Земля</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Операція</span>
            <select name="operation" className="geo-select">
              <option value="">усі</option>
              <option value="sale">Продаж</option>
              <option value="rent">Оренда</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Джерело</span>
            <select name="source" defaultValue="domria" className="geo-select">
              <option value="domria">DOM.RIA (реальні)</option>
              <option value="prozorro">Prozorro (реальні)</option>
              <option value="">усі джерела</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Площа від/до</span>
            <div className="flex gap-2">
              <input name="areaMin" type="number" placeholder="від" className="geo-select" />
              <input name="areaMax" type="number" placeholder="до" className="geo-select" />
            </div>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Ціна від/до</span>
            <div className="flex gap-2">
              <input name="priceMin" type="number" placeholder="від" className="geo-select" />
              <input name="priceMax" type="number" placeholder="до" className="geo-select" />
            </div>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => search()}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Пошук…' : 'Знайти'}
          </button>
          <button
            type="submit"
            name="format"
            value="xlsx"
            className="rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-700"
          >
            Експорт XLSX (−1 запит)
          </button>
          <button
            type="submit"
            name="format"
            value="csv"
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
          >
            CSV
          </button>
          <span className="text-xs text-ink-500">Залишок квоти: {quota}</span>
        </div>
      </form>

      {total !== null && (
        <div className="mt-4">
          {stats && stats.count > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Середня ціна" value={fmt(stats.avgPrice)} />
              <StatCard label="Медіана ціни" value={fmt(stats.medianPrice)} />
              <StatCard label="Середня за м²" value={fmt(stats.avgPpsqm)} />
              <StatCard label="Медіана за м²" value={fmt(stats.medianPpsqm)} />
            </div>
          )}
          <p className="mb-2 text-sm text-ink-500">
            Знайдено: {total} (показано {items.length}). Натисніть на заголовок стовпця для сортування.
          </p>
          <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/40 text-left text-ink-500">
                <tr>
                  <Th label="Район" />
                  <Th label="Сегмент" />
                  <Th label="Опер." />
                  <Th col="area" label="Площа" />
                  <Th col="price" label="Ціна" />
                  <Th col="ppsqm" label="за м²" />
                  <Th col="published" label="Дата" />
                  <Th label="Джерело" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-ink-100">
                    <td className="px-3 py-1.5">{it.unit}</td>
                    <td className="px-3 py-1.5">{SEG_LABEL[it.segment] ?? it.segment}</td>
                    <td className="px-3 py-1.5">{it.operation === 'rent' ? 'Оренда' : 'Продаж'}</td>
                    <td className="px-3 py-1.5">{it.area} м²</td>
                    <td className="px-3 py-1.5">{it.price ? formatPrice(it.price, it.currency) : '—'}</td>
                    <td className="px-3 py-1.5">{it.pricePerSqm ? formatPrice(it.pricePerSqm, it.currency) : '—'}</td>
                    <td className="px-3 py-1.5">{it.published}</td>
                    <td className="px-3 py-1.5">
                      {it.url ? (
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:underline"
                        >
                          {it.source === 'domria' ? 'dom.ria.com ↗' : `${it.source} ↗`}
                        </a>
                      ) : (
                        <span className="text-ink-400">{it.source}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* ToS DOM.RIA: видимый бэклинк на источник + Prozorro (відкриті дані) */}
          <p className="mt-3 text-xs text-ink-400">
            Джерела даних:{' '}
            <a
              href="https://dom.ria.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              dom.ria.com
            </a>
            ,{' '}
            <a
              href="https://prozorro.sale"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              Prozorro.Sale
            </a>
            . Ціни нормалізовано до грн; дані наведено в інформаційних цілях.
          </p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-ink-900">{value}</div>
    </div>
  )
}
