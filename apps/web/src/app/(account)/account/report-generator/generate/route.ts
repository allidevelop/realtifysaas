import { getCurrentUser } from '@/lib/auth'
import { consumeQuota } from '@/lib/billing/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENGINE = () => process.env.ENGINE_BASE_URL || 'http://localhost:8000'

// Генерация отчёта оценки (PDF). Обычная форма-POST (не server action) → списываем
// квоту report-generator → engine рендерит PDF → отдаём на скачивание.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  const back = (p: string) => Response.redirect(new URL(p, req.url), 303)
  if (!user) return back('/account/login')

  const form = await req.formData()
  const body = {
    adminUnitId: Number(form.get('adminUnitId')) || undefined,
    segment: String(form.get('segment') ?? 'apartment'),
    operation: String(form.get('operation') ?? 'sale'),
    area: Number(form.get('area')) || 0,
    floor: Number(form.get('floor')) || undefined,
    totalFloors: Number(form.get('totalFloors')) || undefined,
  }
  if (!body.adminUnitId || body.area <= 0) {
    return back('/account/report-generator?error=invalid')
  }

  const runId = String(form.get('runId') ?? '')
  const q = await consumeQuota(user, 'report-generator', { runId: runId || undefined })
  if (!q.ok) return back('/account/report-generator?error=quota')

  const res = await fetch(`${ENGINE()}/api/reports/valuation-doc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return back('/account/report-generator?error=engine')

  const pdf = Buffer.from(await res.arrayBuffer())
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="valuation-report.pdf"',
    },
  })
}
