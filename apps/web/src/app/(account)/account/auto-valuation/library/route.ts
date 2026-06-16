import { autovalueFetch, autovalueLogin, type AutovalueJob } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Импорт библиотеки аналогов (файл address->url) → autovalue /api/library/import.
// Квоту НЕ списываем — это пополнение базы, а не оценка.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const access = await resolveModuleAccess(user, 'auto-valuation')
  if (!access.allowed) return Response.json({ error: 'no-access' }, { status: 403 })

  const inForm = await req.formData()
  const file = inForm.get('library_file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Файл бібліотеки обовʼязковий.' }, { status: 400 })
  }

  const out = new FormData()
  out.set('library_file', file, file.name || 'library.csv')

  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return Response.json({ error: 'Сервіс автооцінки недоступний.' }, { status: 502 })
  }

  const res = await autovalueFetch('/api/library/import', cookie, { method: 'POST', body: out })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    return Response.json({ error: `autovalue ${res.status}: ${t.slice(0, 200)}` }, { status: 502 })
  }
  const job = (await res.json()) as AutovalueJob
  return Response.json({ jobId: job.id, status: job.status })
}
