'use client'

import { useEffect, useRef, useState } from 'react'

import { Select } from '@/components/ui/Select'
import { quotaLabel } from '@/lib/format'

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

interface RegisterStatus {
  exists: boolean
  filename?: string
  entries?: number
  updated?: string
  date_from?: string | null
  date_to?: string | null
}

// База дат оцінки (реєстр «Продаж квартир») — оновлюється раз на місяць; джерело
// дати оцінки та дати звіту для всіх майбутніх оцінок (матч за адресою + № квартири).
function RegisterPanel() {
  const [status, setStatus] = useState<RegisterStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const r = await fetch('/account/auto-valuation/register')
      if (r.ok) setStatus((await r.json()) as RegisterStatus)
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    void load()
  }, [])

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setMsg('Оберіть файл реєстру (.xlsx).')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/account/auto-valuation/register', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) {
        setMsg(d.detail || d.error || 'Помилка завантаження.')
        return
      }
      setStatus(d as RegisterStatus)
      setMsg(`Оновлено: ${d.entries} записів${d.date_from ? ` · дати ${d.date_from}–${d.date_to}` : ''}.`)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setMsg('Помилка мережі.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-800">База дат оцінки (реєстр «Продаж квартир»)</h3>
          <p className="mt-0.5 max-w-xl text-xs text-ink-500">
            Джерело дати оцінки та дати звіту. Завантажуйте раз на місяць — далі система підставляє
            дати автоматично за адресою + № квартири. Старий реєстр зберігається в резервній копії.
          </p>
        </div>
        <div className="text-right text-xs leading-5">
          {status?.exists ? (
            <span className="text-ink-700">
              <span className="font-semibold text-emerald-700">{status.entries} записів</span>
              {status.date_from ? (
                <>
                  {' '}
                  · {status.date_from}–{status.date_to}
                </>
              ) : null}
              <span className="block text-ink-400">оновлено {status.updated}</span>
            </span>
          ) : status ? (
            <span className="text-amber-600">Реєстр ще не завантажено</span>
          ) : (
            <span className="text-ink-400">…</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="block text-sm text-ink-600 file:mr-3 file:rounded-lg file:border file:border-ink-200 file:bg-ink-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink-700 hover:file:bg-ink-200"
        />
        <button
          onClick={upload}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Завантаження…' : 'Оновити реєстр'}
        </button>
        {msg ? <span className="text-xs text-ink-600">{msg}</span> : null}
      </div>
    </div>
  )
}

interface KozaStatus {
  exists: boolean
  buildings?: number
  total?: number
}

// База шаблонів («козли») — готові звіти по домах. Для дому з козою система генерує
// звіт КЛОНУВАННЯМ кози (формат/контент/аналоги дому як у клієнта) + дані квартири.
function KozaPanel() {
  const [status, setStatus] = useState<KozaStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const r = await fetch('/account/auto-valuation/koza-base')
      if (r.ok) setStatus((await r.json()) as KozaStatus)
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    void load()
  }, [])

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setMsg('Оберіть файл-звіт (.doc/.docx).')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/account/auto-valuation/koza-base', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) {
        setMsg(d.detail || d.error || 'Помилка завантаження.')
        return
      }
      setStatus(d as KozaStatus)
      setMsg(d.warning || `Додано. Домів у базі: ${d.buildings}, файлів: ${d.total}.`)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setMsg('Помилка мережі.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-800">База шаблонів (готові звіти по домах)</h3>
          <p className="mt-0.5 max-w-xl text-xs text-ink-500">
            Для дому, по якому вже є звіт, система будує новий звіт КЛОНУВАННЯМ цього шаблону
            (формат, опис ЖК, характеристики, аналоги — як у вас), підставляючи дані квартири.
            Завантажуйте нові звіти сюди — далі вони підбираються автоматично за адресою.
          </p>
        </div>
        <div className="text-right text-xs leading-5">
          {status?.exists ? (
            <span className="text-ink-700">
              <span className="font-semibold text-emerald-700">{status.buildings} домів</span>
              <span className="block text-ink-400">{status.total} звітів у базі</span>
            </span>
          ) : status ? (
            <span className="text-amber-600">База порожня</span>
          ) : (
            <span className="text-ink-400">…</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".doc,.docx"
          className="block text-sm text-ink-600 file:mr-3 file:rounded-lg file:border file:border-ink-200 file:bg-ink-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink-700 hover:file:bg-ink-200"
        />
        <button
          onClick={upload}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Завантаження…' : 'Додати шаблон'}
        </button>
        {msg ? <span className="text-xs text-ink-600">{msg}</span> : null}
      </div>
    </div>
  )
}

export function AutoValuationModule({ quota }: { quota: number }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forceResearch, setForceResearch] = useState(false)

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
    <div className="mt-6 space-y-5">
      <KozaPanel />
      <RegisterPanel />
      <div className="grid gap-5 lg:grid-cols-2">
      <form ref={formRef} onSubmit={start} className="space-y-3 rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm">
        <p className="rounded-lg bg-ink-100/40 px-3 py-2 text-xs text-ink-600">
          Завантажте PDF (витяг / техпаспорт). Система розпізнає обʼєкт, візьме аналоги з бази
          (або знайде та збереже нові), порахує вартість і згенерує Word-звіт. Один звіт — 1 запит.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">PDF витяг / техпаспорт * (можна кілька файлів)</span>
          <input name="pdf_file" type="file" accept="application/pdf,.pdf" required multiple className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border file:border-ink-200 file:bg-ink-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink-700 hover:file:bg-ink-200" />
          <span className="mt-1 block text-xs text-ink-500">
            Якщо витяг і техпаспорт у різних сканах — оберіть обидва (зливаються автоматично).
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Тип обʼєкта</span>
            <Select
              name="profile"
              defaultValue="apartment"
              options={PROFILES.map((p) => ({ value: p.v, label: p.l }))}
            />
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Мін. аналогів</span>
            <input name="required_count" type="number" defaultValue={5} min={1} max={10} className="geo-select" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-700">Назва ЖК / комплексу (необовʼязково)</span>
          <input name="complex_name" type="text" placeholder="ЖК Берег Дніпра" className="geo-select" />
        </label>
        <div className="rounded-lg border border-ink-200 bg-ink-100/30 p-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="force_research"
              value="true"
              checked={forceResearch}
              onChange={(e) => setForceResearch(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-600"
            />
            <span>
              <span className="font-medium text-ink-800">Примусово шукати аналоги заново</span>
              <span className="mt-0.5 block text-xs text-ink-500">
                Не використовувати збережену базу — знайти свіжі аналоги того ж ЖК/будинку і оновити базу.
              </span>
            </span>
          </label>
          {forceResearch && (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-ink-700">Посилання на каталог ЖК (рекомендовано)</span>
              <input
                name="search_url"
                type="url"
                placeholder="https://dom.ria.com/uk/prodazha-kvartir/… (або сторінка ЖК на rieltor/lun)"
                className="geo-select"
              />
              <span className="mt-1 block text-xs text-ink-500">
                Вставте сторінку дому/ЖК на dom.ria, rieltor чи lun — пошук буде точно в цьому будинку.
                Без посилання система спробує знайти автоматично за адресою.
              </span>
            </label>
          )}
        </div>
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
          <span className="text-xs text-ink-500">Залишок квоти: {quotaLabel(quota)}</span>
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

            {job.status === 'passed' && (
              <a
                href={`/account/auto-valuation/editor/${job.id}`}
                className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                ✎ Відкрити в редакторі — правка та експорт PDF / Word
              </a>
            )}

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
    </div>
  )
}
