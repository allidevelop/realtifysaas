'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import type { UnitOption } from './ValuationModule'

// Поисковый комбобокс территориальной единицы с автокомплитом (замена <select>).
// Скрытый input хранит id выбранной единицы для формы.
export function UnitCombobox({
  units,
  name,
  defaultId,
}: {
  units: UnitOption[]
  name: string
  defaultId?: number
}) {
  const listId = useId()
  const initial = useMemo(
    () => units.find((u) => u.id === defaultId) ?? units[0],
    [units, defaultId],
  )
  const [selected, setSelected] = useState<UnitOption | undefined>(initial)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const norm = (s: string) => s.toLowerCase().trim()
  const filtered = useMemo(() => {
    const q = norm(query)
    if (!q) return units.slice(0, 80)
    const res: UnitOption[] = []
    for (const u of units) {
      if (norm(u.name).includes(q) || (u.parentName && norm(u.parentName).includes(q))) {
        res.push(u)
        if (res.length >= 80) break
      }
    }
    return res
  }, [units, query])

  // Закрытие по клику вне.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function pick(u: UnitOption) {
    setSelected(u)
    setQuery('')
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) pick(filtered[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        className="geo-select"
        placeholder="Почніть вводити район…"
        value={open ? query : (selected?.name ?? '')}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onKeyDown={onKey}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-ink-100 bg-surface py-1 shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-400">Нічого не знайдено</li>
          )}
          {filtered.map((u, i) => (
            <li
              key={u.id}
              role="option"
              aria-selected={u.id === selected?.id}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(u)
              }}
              className={`flex cursor-pointer items-baseline justify-between gap-2 px-3 py-1.5 text-sm ${
                i === active ? 'bg-brand-50 text-brand-700' : 'text-ink-700'
              }`}
            >
              <span>{u.name}</span>
              {u.parentName && <span className="shrink-0 text-xs text-ink-400">{u.parentName}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
