import { autovalueFetch, autovalueLogin, type AutovalueJob } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'
import { consumeQuota } from '@/lib/billing/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Старт задания автооценки: приём PDF+Excel → autovalue /api/jobs (списание квоты).
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const access = await resolveModuleAccess(user, 'auto-valuation')
  if (!access.allowed) return Response.json({ error: 'no-access' }, { status: 403 })
  if ((access.quotaRemaining ?? 0) < 1) return Response.json({ error: 'quota' }, { status: 402 })

  const inForm = await req.formData()
  const pdf = inForm.get('pdf_file')
  const excel = inForm.get('excel_template')
  if (!(pdf instanceof File) || !(excel instanceof File)) {
    return Response.json({ error: 'PDF та Excel-шаблон обовʼязкові.' }, { status: 400 })
  }

  const out = new FormData()
  out.set('pdf_file', pdf, pdf.name || 'input.pdf')
  out.set('excel_template', excel, excel.name || 'template.xls')
  out.set('profile', String(inForm.get('profile') || 'apartment'))
  out.set('required_count', String(inForm.get('required_count') || '5'))
  const complex = String(inForm.get('complex_name') || '')
  if (complex) out.set('complex_name', complex)
  const fp = String(inForm.get('first_page') || '')
  const lp = String(inForm.get('last_page') || '')
  if (fp) out.set('first_page', fp)
  if (lp) out.set('last_page', lp)

  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return Response.json({ error: 'Сервіс автооцінки недоступний.' }, { status: 502 })
  }

  const res = await autovalueFetch('/api/jobs', cookie, { method: 'POST', body: out })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    return Response.json({ error: `autovalue ${res.status}: ${t.slice(0, 200)}` }, { status: 502 })
  }
  const job = (await res.json()) as AutovalueJob

  // Списываем квоту только после успешного создания задания.
  await consumeQuota(user, 'auto-valuation', {
    runId: String(inForm.get('runId') ?? '') || job.id,
  })
  return Response.json({ jobId: job.id, status: job.status })
}
