import { getCurrentUser } from '@/lib/auth'
import { consumeQuota } from '@/lib/billing/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENGINE = () => process.env.ENGINE_BASE_URL || 'http://localhost:8000'

// Генерация СТАТИСТИЧЕСКОГО отчёта (PDF) средних цен по АТЕ/периодам (аналог
// «Генератор звітів» референса). Форма-POST → списываем квоту → engine рендерит
// многостраничный PDF (динамика міс/кв, разрез по подчинённым АТЕ) → скачивание.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  const back = (p: string) => Response.redirect(new URL(p, req.url), 303)
  if (!user) return back('/account/login')

  const form = await req.formData()
  const body = {
    adminUnitId: Number(form.get('adminUnitId')) || undefined,
    segment: String(form.get('segment') ?? 'apartment'),
    operation: String(form.get('operation') ?? 'sale'),
  }
  if (!body.adminUnitId) return back('/account/report-generator?error=invalid')

  const runId = String(form.get('runId') ?? '')
  const q = await consumeQuota(user, 'report-generator', { runId: runId || undefined })
  if (!q.ok) return back('/account/report-generator?error=quota')

  const res = await fetch(`${ENGINE()}/api/reports/stat-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return back('/account/report-generator?error=engine')

  const pdf = Buffer.from(await res.arrayBuffer())
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="stat-report.pdf"',
    },
  })
}
