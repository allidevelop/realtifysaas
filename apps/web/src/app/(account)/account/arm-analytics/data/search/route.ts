import { searchListings } from '@/lib/analytics/engine'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Превью поиска объявлений (без списания квоты; квота — на экспорт).
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const access = await resolveModuleAccess(user, 'arm-analytics')
  if (!access.allowed) return Response.json({ error: 'no-access' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const data = await searchListings({
    adminUnitId: sp.get('adminUnitId') || undefined,
    segment: sp.get('segment') || undefined,
    operation: sp.get('operation') || undefined,
    areaMin: sp.get('areaMin') || undefined,
    areaMax: sp.get('areaMax') || undefined,
    priceMin: sp.get('priceMin') || undefined,
    priceMax: sp.get('priceMax') || undefined,
    limit: 50,
  })
  return Response.json(data)
}
