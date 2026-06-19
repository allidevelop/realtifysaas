import { autovalueFetch, autovalueLogin } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Експорт звіту у PDF (data-driven). Без додаткової квоти — генерацію вже оплачено.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const access = await resolveModuleAccess(user, 'auto-valuation')
  if (!access.allowed) return Response.json({ error: 'no-access' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const job = sp.get('job') || ''
  const object = sp.get('object') || ''
  if (!/^[0-9a-z_]+$/i.test(job)) return Response.json({ error: 'bad job id' }, { status: 400 })

  const body = await req.text()
  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return Response.json({ error: 'Сервіс автооцінки недоступний.' }, { status: 502 })
  }
  const q = object ? `?object=${encodeURIComponent(object)}` : ''
  const res = await autovalueFetch(`/api/jobs/${job}/export-pdf${q}`, cookie, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
