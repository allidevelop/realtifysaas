'use client'

import { useEffect, useId, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  /** Имя скрытого поля для отправки в форме (необязательно для controlled). */
  name?: string
  /** Controlled-значение. */
  value?: string
  /** Начальное значение (uncontrolled). */
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

// Премиальный кастомный select: полный контроль над открытым списком
// (нативный <select> рисует список средствами ОС и не стилизуется).
export function Select({
  options,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = 'Оберіть…',
  className = '',
}: SelectProps) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value ?? '')
  const current = isControlled ? value : internal
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === current)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(v: string) {
    if (!isControlled) setInternal(v)
    onChange?.(v)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-[0.625rem] border bg-surface px-3 py-[0.5625rem] text-left text-sm text-ink-900 shadow-xs hover:border-ink-300 ${
          open ? 'border-brand-500 ring-[3px] ring-brand-100' : 'border-ink-200'
        }`}
      >
        <span className={selected ? '' : 'text-ink-400'}>{selected ? selected.label : placeholder}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-ink-200 bg-surface p-1.5 shadow-lg"
        >
          {options.map((o) => {
            const active = o.value === current
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    active
                      ? 'bg-brand-50 font-medium text-brand-700'
                      : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {active && (
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
