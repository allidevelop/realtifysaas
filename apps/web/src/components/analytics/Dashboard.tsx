'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { SeriesResult } from '@/lib/analytics/engine'

interface UnitOption {
  id: number
  name: string
  parentName: string | null
}

const SEG_COLOR: Record<string, string> = {
  apartment: '#2f6fed',
  house: '#16a34a',
  commercial: '#d97706',
  land: '#9333ea',
}
const SEG_LABEL: Record<string, string> = {
  apartment: 'Квартири', house: 'Будинки', commercial: 'Комерція', land: 'Земля',
}

export function Dashboard({ units }: { units: UnitOption[] }) {
  const [adminUnitId, setAdminUnitId] = useState(String(units[0]?.id ?? ''))
  const [operation, setOperation] = useState('sale')
  const [data, setData] = useState<SeriesResult | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!adminUnitId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/account/interactive-report/data/series?adminUnitId=${adminUnitId}&operation=${operation}&metric=avg_price_sqm`,
      )
      setData((await res.json()) as SeriesResult)
    } finally {
      setLoading(false)
    }
  }, [adminUnitId, operation])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = new Map<string, UnitOption[]>()
  for (const u of units) {
    const k = u.parentName ?? '—'
    if (!grouped.has(k)) grouped.set(k, [])
    grouped.get(k)!.push(u)
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap gap-3 rounded-2xl border border-ink-100 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink-700">Район</span>
          <select value={adminUnitId} onChange={(e) => setAdminUnitId(e.target.value)} className="geo-select">
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
          <span className="mb-1 block font-medium text-ink-700">Операція</span>
          <select value={operation} onChange={(e) => setOperation(e.target.value)} className="geo-select">
            <option value="sale">Продаж</option>
            <option value="rent">Оренда</option>
          </select>
        </label>
      </div>

      {loading && <p className="text-sm text-ink-500">Завантаження…</p>}

      {data && (
        <>
          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-900">Динаміка ціни за м² (грн)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.trend} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="period" fontSize={12} />
                <YAxis fontSize={12} width={70} />
                <Tooltip />
                <Legend />
                {data.segments.map((seg) => (
                  <Line
                    key={seg}
                    type="monotone"
                    dataKey={seg}
                    name={SEG_LABEL[seg] ?? seg}
                    stroke={SEG_COLOR[seg] ?? '#64748b'}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-900">
              Ціна за м² за сегментами{data.latest ? ` (${data.latest})` : ''}
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.bySegment} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis
                  dataKey="segment"
                  fontSize={12}
                  tickFormatter={(s: string) => SEG_LABEL[s] ?? s}
                />
                <YAxis fontSize={12} width={70} />
                <Tooltip />
                <Bar dataKey="value" name="грн/м²" fill="#2f6fed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
