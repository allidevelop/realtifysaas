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
  const pdfs = inForm.getAll('pdf_file').filter((p): p is File => p instanceof File && p.size > 0)
  if (pdfs.length === 0) {
    return Response.json({ error: 'Потрібен щонайменше один PDF.' }, { status: 400 })
  }

  const out = new FormData()
  // Кілька PDF (витяг + техпаспорт окремими сканами) — autovalue зливає їх.
  for (const pdf of pdfs) out.append('pdf_file', pdf, pdf.name || 'input.pdf')
  out.set('profile', String(inForm.get('profile') || 'apartment'))
  out.set('required_count', String(inForm.get('required_count') || '5'))
  const complex = String(inForm.get('complex_name') || '')
  if (complex) out.set('complex_name', complex)
  // Примусовий пошук аналогів заново (ігнорувати базу) + опц. посилання на каталог ЖК
  const forceResearch = inForm.get('force_research')
  if (forceResearch === 'true' || forceResearch === 'on') {
    out.set('force_research', 'true')
    const searchUrl = String(inForm.get('search_url') || '').trim()
    if (searchUrl) out.set('search_url', searchUrl)
  }
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
