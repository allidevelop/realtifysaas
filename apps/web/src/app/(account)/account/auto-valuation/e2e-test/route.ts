import { autovalueFetch, autovalueLogin } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Сторінка E2E-самотесту коза-клон генерації (HTML з autovalue). Гейт: вхід + auto-valuation.
async function gate(): Promise<Response | null> {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const access = await resolveModuleAccess(user, 'auto-valuation')
  if (!access.allowed) return new Response('no-access', { status: 403 })
  return null
}

async function proxy(method: 'GET' | 'POST'): Promise<Response> {
  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return new Response('Сервіс автооцінки недоступний.', { status: 502 })
  }
  const res = await autovalueFetch('/api/e2e-test', cookie, { method })
  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET() {
  const denied = await gate()
  if (denied) return denied
  return proxy('GET')
}

export async function POST() {
  const denied = await gate()
  if (denied) return denied
  return proxy('POST')
}
