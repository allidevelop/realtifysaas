import { autovalueFetch, autovalueLogin } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Міст до autovalue report-json (data-driven звіт). Гейт: вхід + доступ до auto-valuation.
// Експорт/редагування звіту, який уже згенеровано, додаткову квоту НЕ списує.
async function authGate(): Promise<Response | null> {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const access = await resolveModuleAccess(user, 'auto-valuation')
  if (!access.allowed) return Response.json({ error: 'no-access' }, { status: 403 })
  return null
}

function params(req: Request): { job: string; object: string } | null {
  const sp = new URL(req.url).searchParams
  const job = sp.get('job') || ''
  const object = sp.get('object') || ''
  if (!/^[0-9a-z_]+$/i.test(job)) return null
  return { job, object }
}

export async function GET(req: Request) {
  const denied = await authGate()
  if (denied) return denied
  const p = params(req)
  if (!p) return Response.json({ error: 'bad job id' }, { status: 400 })
  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return Response.json({ error: 'Сервіс автооцінки недоступний.' }, { status: 502 })
  }
  const q = p.object ? `?object=${encodeURIComponent(p.object)}` : ''
  const res = await autovalueFetch(`/api/jobs/${p.job}/report-json${q}`, cookie)
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function PUT(req: Request) {
  const denied = await authGate()
  if (denied) return denied
  const p = params(req)
  if (!p) return Response.json({ error: 'bad job id' }, { status: 400 })
  const body = await req.text()
  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return Response.json({ error: 'Сервіс автооцінки недоступний.' }, { status: 502 })
  }
  const q = p.object ? `?object=${encodeURIComponent(p.object)}` : ''
  const res = await autovalueFetch(`/api/jobs/${p.job}/report-json${q}`, cookie, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
