'use client'

import { useRef, useState } from 'react'

import type { Listing } from '@/lib/analytics/engine'
import { formatPrice } from '@/lib/format'

interface UnitOption {
  id: number
  name: string
  parentName: string | null
}

function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function ListingsSearch({ units, quota }: { units: UnitOption[]; quota: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [items, setItems] = useState<Listing[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const grouped = new Map<string, UnitOption[]>()
  for (const u of units) {
    const k = u.parentName ?? '—'
    if (!grouped.has(k)) grouped.set(k, [])
    grouped.get(k)!.push(u)
  }

  async function search() {
    if (!formRef.current) return
    setLoading(true)
    const fd = new FormData(formRef.current)
    const sp = new URLSearchParams()
    for (const k of ['adminUnitId', 'segment', 'operation', 'areaMin', 'areaMax', 'priceMin', 'priceMax']) {
      const v = fd.get(k)
      if (v) sp.set(k, String(v))
    }
    try {
      const res = await fetch(`/account/arm-analytics/data/search?${sp.toString()}`)
      const d = (await res.json()) as { items: Listing[]; total: number }
      setItems(d.items ?? [])
      setTotal(d.total ?? 0)
    } finally {
      setLoading(false)
    }
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
            <span className="mb-1 block font-medium text-ink-700">Площа від/до</span>
            <div className="flex gap-2">
              <input name="areaMin" type="number" placeholder="від" className="geo-select" />
              <input name="areaMax" type="number" placeholder="до" className="geo-select" />
            </div>
          </label>
          <label className="text-sm sm:col-span-2">
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
            onClick={search}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Пошук…' : 'Знайти'}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-700"
          >
            Експорт CSV (−1 запит)
          </button>
          <span className="text-xs text-ink-500">Залишок квоти: {quota}</span>
        </div>
      </form>

      {total !== null && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-ink-500">Знайдено: {total} (показано {items.length})</p>
          <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/40 text-left text-ink-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Район</th>
                  <th className="px-3 py-2 font-medium">Сегмент</th>
                  <th className="px-3 py-2 font-medium">Опер.</th>
                  <th className="px-3 py-2 font-medium">Площа</th>
                  <th className="px-3 py-2 font-medium">Ціна</th>
                  <th className="px-3 py-2 font-medium">за м²</th>
                  <th className="px-3 py-2 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-ink-100">
                    <td className="px-3 py-1.5">{it.unit}</td>
                    <td className="px-3 py-1.5">{it.segment}</td>
                    <td className="px-3 py-1.5">{it.operation}</td>
                    <td className="px-3 py-1.5">{it.area} м²</td>
                    <td className="px-3 py-1.5">{it.price ? formatPrice(it.price, it.currency) : '—'}</td>
                    <td className="px-3 py-1.5">{it.pricePerSqm ? formatPrice(it.pricePerSqm, it.currency) : '—'}</td>
                    <td className="px-3 py-1.5">{it.published}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
