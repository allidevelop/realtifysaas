'use client'

import { useEffect, useState } from 'react'

interface Group {
  address_key: string
  address: string | null
  complex_name: string | null
  city: string | null
  count: number
  updated_at: string | null
}

interface Item {
  id: number
  address_key: string
  city: string | null
  address: string | null
  complex_name: string | null
  property_type: string | null
  area_m2: number | null
  price_usd: number | null
  price_per_m2_usd: number | null
  floor_or_level: string | null
  rooms: number | null
  location_quality: string | null
  building_class: string | null
  condition: string | null
  delivery_date: string | null
  listing_date: string | null
  source_url: string | null
  [key: string]: unknown
}

const FIELDS: { key: keyof Item; label: string; type?: 'number'; readonly?: boolean; width: string }[] = [
  { key: 'address', label: 'Адреса', width: 'w-56' },
  { key: 'area_m2', label: 'Площа, м²', type: 'number', width: 'w-24' },
  { key: 'floor_or_level', label: 'Поверх', width: 'w-20' },
  { key: 'price_usd', label: 'Ціна, USD', type: 'number', width: 'w-28' },
  { key: 'price_per_m2_usd', label: '$/м²', readonly: true, width: 'w-20' },
  { key: 'location_quality', label: 'Розташування', width: 'w-28' },
  { key: 'building_class', label: 'Клас ЖК', width: 'w-28' },
  { key: 'condition', label: 'Оздоблення', width: 'w-32' },
  { key: 'delivery_date', label: 'Термін', width: 'w-24' },
  { key: 'source_url', label: 'Джерело', width: 'w-44' },
]

const API = '/account/analog-database/data'

export function AnalogDatabase() {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, Item[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void loadGroups()
  }, [])

  async function loadGroups() {
    setError(null)
    try {
      const r = await fetch(`${API}?type=groups`)
      const d = await r.json()
      setGroups(d.groups ?? [])
    } catch {
      setError('Не вдалося завантажити базу.')
      setGroups([])
    }
  }

  async function toggle(key: string) {
    if (open === key) {
      setOpen(null)
      return
    }
    setOpen(key)
    if (!items[key]) await loadItems(key)
  }

  async function loadItems(key: string) {
    const r = await fetch(`${API}?address_key=${encodeURIComponent(key)}`)
    const d = await r.json()
    setItems((m) => ({ ...m, [key]: d.items ?? [] }))
  }

  function setField(key: string, id: number, field: keyof Item, value: string) {
    setItems((m) => ({
      ...m,
      [key]: (m[key] ?? []).map((it) =>
        it.id === id ? { ...it, [field]: value === '' ? null : value } : it,
      ),
    }))
  }

  async function save(key: string, item: Item) {
    setBusy(`save-${item.id}`)
    setError(null)
    try {
      const r = await fetch(`${API}?id=${item.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item),
      })
      const d = await r.json()
      if (d.item) {
        setItems((m) => ({ ...m, [key]: (m[key] ?? []).map((it) => (it.id === item.id ? d.item : it)) }))
      }
    } catch {
      setError('Помилка збереження.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(key: string, id: number) {
    if (!confirm('Видалити цей аналог?')) return
    setBusy(`del-${id}`)
    try {
      await fetch(`${API}?id=${id}`, { method: 'DELETE' })
      setItems((m) => ({ ...m, [key]: (m[key] ?? []).filter((it) => it.id !== id) }))
      setGroups((gs) => (gs ?? []).map((g) => (g.address_key === key ? { ...g, count: g.count - 1 } : g)))
    } finally {
      setBusy(null)
    }
  }

  async function add(group: Group) {
    setBusy(`add-${group.address_key}`)
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address: group.address,
          complex_name: group.complex_name,
          city: group.city,
          property_type: 'apartment',
          source_key: 'manual',
        }),
      })
      const d = await r.json()
      if (d.item) {
        setItems((m) => ({ ...m, [group.address_key]: [...(m[group.address_key] ?? []), d.item] }))
        setGroups((gs) => (gs ?? []).map((g) => (g.address_key === group.address_key ? { ...g, count: g.count + 1 } : g)))
      }
    } finally {
      setBusy(null)
    }
  }

  const visible = (groups ?? []).filter((g) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (g.complex_name || '').toLowerCase().includes(q) || (g.address || '').toLowerCase().includes(q) || (g.city || '').toLowerCase().includes(q)
  })

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук за ЖК / адресою / містом…"
          className="geo-select max-w-md"
        />
        <span className="text-sm text-ink-500">
          {groups ? `${groups.length} адрес / ЖК` : 'Завантаження…'}
        </span>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {groups && groups.length === 0 && (
        <p className="rounded-xl border border-ink-200 bg-surface p-6 text-sm text-ink-500">
          База порожня. Аналоги зʼявляться після імпорту звітів або автоматично під час оцінок.
        </p>
      )}

      <div className="space-y-2">
        {visible.map((g) => {
          const isOpen = open === g.address_key
          const rows = items[g.address_key] ?? []
          return (
            <div key={g.address_key} className="overflow-hidden rounded-xl border border-ink-200 bg-surface">
              <button
                onClick={() => toggle(g.address_key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink-100/40"
              >
                <span className="flex items-center gap-2">
                  <span className={`text-ink-400 transition ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                  <span className="font-medium text-ink-900">
                    {g.complex_name ? `ЖК ${g.complex_name}` : g.address || g.address_key}
                  </span>
                  {g.complex_name && g.address && <span className="text-sm text-ink-500">· {g.address}</span>}
                  {g.city && <span className="text-xs text-ink-400">· {g.city}</span>}
                </span>
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-600">
                  {g.count} аналог.
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-ink-100 p-3">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="text-left text-ink-500">
                          {FIELDS.map((f) => (
                            <th key={String(f.key)} className="px-1.5 py-1 font-medium">{f.label}</th>
                          ))}
                          <th className="px-1.5 py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((it) => (
                          <tr key={it.id} className="border-t border-ink-100 align-top">
                            {FIELDS.map((f) => (
                              <td key={String(f.key)} className="px-1 py-1">
                                <input
                                  type={f.type === 'number' ? 'number' : 'text'}
                                  readOnly={f.readonly}
                                  value={(it[f.key] as string | number | null) ?? ''}
                                  onChange={(e) => setField(g.address_key, it.id, f.key, e.target.value)}
                                  className={`${f.width} rounded-md border border-ink-200 bg-white px-1.5 py-1 ${f.readonly ? 'bg-ink-100/50 text-ink-500' : ''}`}
                                />
                              </td>
                            ))}
                            <td className="whitespace-nowrap px-1 py-1">
                              <button
                                onClick={() => save(g.address_key, it)}
                                disabled={busy === `save-${it.id}`}
                                className="mr-1 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                              >
                                Зберегти
                              </button>
                              <button
                                onClick={() => remove(g.address_key, it.id)}
                                disabled={busy === `del-${it.id}`}
                                className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => add(g)}
                    disabled={busy === `add-${g.address_key}`}
                    className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                  >
                    + Додати аналог
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
