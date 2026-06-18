'use client'

import { useEffect, useRef, useState } from 'react'

interface JobStatus {
  id: string
  status: string
  error: string | null
  events: string[]
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'у черзі',
  running: 'імпорт…',
  passed: 'готово',
  failed: 'помилка',
}

export function LibraryImport({ onDone }: { onDone?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const done = !!job && ['passed', 'failed', 'cancelled'].includes(job.status)

  useEffect(() => {
    if (!jobId || done) return
    let stop = false
    const tick = async () => {
      try {
        const r = await fetch(`/account/analog-database/data?type=job-status&id=${jobId}`)
        if (r.ok) {
          const d = (await r.json()) as JobStatus
          if (!stop) setJob(d)
        }
      } catch {
        /* ретрай на наступному тіку */
      }
    }
    void tick()
    const id = setInterval(tick, 3000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [jobId, done])

  // Після успішного імпорту — оновити список груп у базі.
  useEffect(() => {
    if (job?.status === 'passed') onDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setError(null)
    setBusy(true)
    setJob(null)
    setJobId(null)
    try {
      const fd = new FormData(formRef.current)
      const r = await fetch('/account/analog-database/data?type=import-library', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error || 'Помилка імпорту.')
        return
      }
      setJobId(d.jobId)
    } catch {
      setError('Помилка мережі.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="text-base font-semibold text-ink-900">Масовий імпорт аналогів (CSV / Excel)</span>
          <span className="mt-0.5 block text-sm text-ink-500">
            Масовий імпорт: завантажте файл «адреса → посилання на аналоги» — система збере дані
            й скриншоти та додасть їх у цю базу. Зручно завести багато аналогів разом.
          </span>
        </span>
        <svg
          className={`h-5 w-5 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
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
        <form ref={formRef} onSubmit={submit} className="mt-4 space-y-3">
          <p className="rounded-lg bg-ink-100/60 px-3 py-2 text-xs text-ink-600">
            Формат (CSV / Excel, роздільник <code>;</code> або <code>,</code>): стовпці{' '}
            <b>address</b>, <b>url</b> (обовʼязкові), та опційно <b>city</b>, <b>property_type</b>,{' '}
            <b>complex_name</b>. Один рядок = один аналог; кілька рядків з тією ж адресою = аналоги
            цього будинку.
          </p>
          <input
            name="library_file"
            type="file"
            accept=".csv,.xlsx,.txt,text/csv"
            required
            className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border file:border-ink-200 file:bg-ink-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink-700 hover:file:bg-ink-200"
          />
          <button
            type="submit"
            disabled={busy || (!!jobId && !done)}
            className="rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-60"
          >
            {busy ? 'Завантаження…' : !!jobId && !done ? 'Імпорт…' : 'Імпортувати бібліотеку'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}

          {jobId && job && (
            <div className="mt-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-800">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    job.status === 'passed'
                      ? 'bg-emerald-500'
                      : job.status === 'failed'
                        ? 'bg-red-500'
                        : 'animate-pulse bg-amber-500'
                  }`}
                />
                Статус: {STATUS_LABEL[job.status] ?? job.status}
              </div>
              {job.error && <p className="mb-2 text-sm text-red-600">{job.error}</p>}
              <div className="max-h-60 overflow-auto rounded-lg bg-ink-900/95 p-3 font-mono text-xs text-ink-100">
                {job.events.map((ev, i) => (
                  <div key={i} className="whitespace-pre-wrap">{ev}</div>
                ))}
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
