import { autovalueFetch, autovalueLogin } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Міст до autovalue valuation-register: керований реєстр дат оцінки (база, оновлюється
// раз на місяць). Гейт: вхід + доступ до auto-valuation. Завантаження квоту НЕ списує.
async function gate(): Promise<Response | null> {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const access = await resolveModuleAccess(user, 'auto-valuation')
  if (!access.allowed) return Response.json({ error: 'no-access' }, { status: 403 })
  return null
}

export async function GET() {
  const denied = await gate()
  if (denied) return denied
  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return Response.json({ error: 'Сервіс автооцінки недоступний.' }, { status: 502 })
  }
  const res = await autovalueFetch('/api/valuation-register', cookie)
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: Request) {
  const denied = await gate()
  if (denied) return denied

  const inForm = await req.formData()
  const file = inForm.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: 'Потрібен Excel-файл реєстру.' }, { status: 400 })
  }
  const out = new FormData()
  out.append('file', file, file.name || 'register.xlsx')

  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return Response.json({ error: 'Сервіс автооцінки недоступний.' }, { status: 502 })
  }
  const res = await autovalueFetch('/api/valuation-register', cookie, { method: 'POST', body: out })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
