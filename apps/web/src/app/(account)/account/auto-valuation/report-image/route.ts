import { autovalueFetch, autovalueLogin } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Міст до autovalue report-image: раздача однієї картинки звіту (щоб JSON редактора
// лишався лёгким — картинки тягнуться окремо). Гейт: вхід + доступ до auto-valuation.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const access = await resolveModuleAccess(user, 'auto-valuation')
  if (!access.allowed) return new Response('no-access', { status: 403 })

  const sp = new URL(req.url).searchParams
  const job = sp.get('job') || ''
  const object = sp.get('object') || ''
  const node = sp.get('node') || ''
  if (!/^[0-9a-z_]+$/i.test(job) || !/^\d+$/.test(node)) {
    return new Response('bad request', { status: 400 })
  }

  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return new Response('autovalue unavailable', { status: 502 })
  }

  const q = `?object=${encodeURIComponent(object)}&node=${node}`
  const res = await autovalueFetch(`/api/jobs/${job}/report-image${q}`, cookie)
  if (!res.ok) return new Response('not found', { status: res.status })

  const buf = await res.arrayBuffer()
  return new Response(buf, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
