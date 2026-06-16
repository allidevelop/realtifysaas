'use client'

import { useEffect, useRef, useState } from 'react'

interface Artifact {
  name: string
  kind: string
  size: number | null
}
interface JobStatus {
  id: string
  status: string
  error: string | null
  events: string[]
  artifacts: Artifact[]
}

function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const PROFILES = [
  { v: 'apartment', l: 'Квартира' },
  { v: 'parking', l: 'Паркінг / машиномісце' },
  { v: 'commercial', l: 'Комерція' },
  { v: 'house', l: 'Будинок' },
  { v: 'land', l: 'Земельна ділянка' },
]

const KIND_LABEL: Record<string, string> = {
  word: 'Word-звіт про оцінку',
  excel: 'Excel-розрахунок',
  validation: 'Валідація',
  report: 'Звіт пакета',
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'у черзі',
  running: 'виконується…',
  cancelling: 'зупиняється…',
  cancelled: 'скасовано',
  passed: 'готово',
  failed: 'помилка',
}

export function AutoValuationModule({ quota }: { quota: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const done = !!job && ['passed', 'failed', 'cancelled'].includes(job.status)

  useEffect(() => {
    if (!jobId || done) return
    let stop = false
    const tick = async () => {
      try {
        const r = await fetch(`/account/auto-valuation/status?job=${jobId}`)
        if (r.ok) {
          const d = (await r.json()) as JobStatus
          if (!stop) setJob(d)
        }
      } catch {
        /* мережеві помилки ігноруємо, наступний тік повторить */
      }
    }
    void tick()
    const id = setInterval(tick, 3000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [jobId, done])

  async function start(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setError(null)
    setBusy(true)
    setJob(null)
    setJobId(null)
    const fd = new FormData(formRef.current)
    fd.set('runId', uuid())
    try {
      const r = await fetch('/account/auto-valuation/start', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error === 'quota' ? 'Квоту вичерпано — придбайте пакет.' : d.error || 'Помилка запуску.')
        return
      }
      setJobId(d.jobId)
    } catch {
      setError('Помилка мережі.')
    } finally {
      setBusy(false)
    }
  }

  const running = !!jobId && !done

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <form ref={formRef} onSubmit={start} className="space-y-3 rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm">
        <p className="rounded-lg bg-ink-100/40 px-3 py-2 text-xs text-ink-600">
          Завантажте PDF (витяг/техпаспорт) і ваш Excel-шаблон розрахунку. Система розпізнає обʼєкт,
          підбере аналоги, заповнить шаблон і згенерує Word-звіт. Один звіт — 1 запит.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">PDF витяг/техпаспорт *</span>
          <input name="pdf_file" type="file" accept="application/pdf,.pdf" required className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border file:border-ink-200 file:bg-ink-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink-700 hover:file:bg-ink-200" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Excel-шаблон розрахунку (.xls/.xlsx) *</span>
          <input name="excel_template" type="file" accept=".xls,.xlsx" required className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border file:border-ink-200 file:bg-ink-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink-700 hover:file:bg-ink-200" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Тип обʼєкта</span>
            <select name="profile" className="geo-select" defaultValue="apartment">
              {PROFILES.map((p) => (
                <option key={p.v} value={p.v}>{p.l}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Мін. аналогів</span>
            <input name="required_count" type="number" defaultValue={5} min={1} max={10} className="geo-select" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Назва ЖК / комплексу (необовʼязково)</span>
          <input name="complex_name" type="text" placeholder="ЖК Берег Дніпра" className="geo-select" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Сторінка PDF від</span>
            <input name="first_page" type="number" min={1} placeholder="1" className="geo-select" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">до</span>
            <input name="last_page" type="number" min={1} placeholder="1" className="geo-select" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={busy || running}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Запуск…' : running ? 'Виконується…' : 'Згенерувати звіт (−1 запит)'}
          </button>
          <span className="text-xs text-ink-500">Залишок квоти: {quota}</span>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {/* Прогрес + результат */}
      <div className="rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm">
        {!job && !jobId && (
          <p className="text-sm text-ink-400">Тут зʼявиться прогрес генерації та готові файли звіту.</p>
        )}
        {jobId && job && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  job.status === 'passed'
                    ? 'bg-emerald-500'
                    : job.status === 'failed' || job.status === 'cancelled'
                      ? 'bg-red-500'
                      : 'animate-pulse bg-amber-500'
                }`}
              />
              <span className="text-sm font-medium text-ink-800">
                Статус: {STATUS_LABEL[job.status] ?? job.status}
              </span>
            </div>

            {job.artifacts.length > 0 && (
              <div className="mb-3 space-y-2">
                {job.artifacts.map((a) => (
                  <a
                    key={a.name}
                    href={`/account/auto-valuation/download?job=${job.id}&name=${encodeURIComponent(a.name)}`}
                    className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2 text-sm text-brand-700 hover:bg-brand-50"
                  >
                    <span>↓ {KIND_LABEL[a.kind] ?? a.name}</span>
                    <span className="text-xs text-ink-400">{a.name}</span>
                  </a>
                ))}
              </div>
            )}

            {job.error && <p className="mb-2 text-sm text-red-600">{job.error}</p>}

            <div className="max-h-72 overflow-auto rounded-lg bg-ink-900/95 p-3 font-mono text-xs text-ink-100">
              {job.events.map((ev, i) => (
                <div key={i} className="whitespace-pre-wrap">{ev}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
