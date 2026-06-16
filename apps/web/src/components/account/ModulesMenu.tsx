'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { MODULE_KEYS, MODULE_META } from '@/lib/billing/modules'

// Выпадающее меню модулей. Нативный <details> не закрывался при client-side
// переходе Next.js — поэтому управляем состоянием и закрываем при смене маршрута,
// клике по пункту и клике вне меню.
export function ModulesMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  // Закрыть при переходе (soft-navigation не перезагружает страницу).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Закрыть по клику вне меню.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-ink-100 hover:text-ink-900 ${
          open ? 'bg-ink-100 text-ink-900' : 'text-ink-700'
        }`}
      >
        Модулі
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
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
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-ink-200 bg-surface p-2 shadow-lg">
          {MODULE_KEYS.map((key) => (
            <Link
              key={key}
              href={`/account/${key}`}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
            >
              {MODULE_META[key].title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
