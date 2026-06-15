import { getCurrentUser } from '@/lib/auth'
import { getGeoAccess } from '@/lib/geo/access'
import { engineGeo, type GeoMetricsResponse } from '@/lib/geo/engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Прокси агрегатов + freemium: период должен быть в allowedPeriods, drill-down — при canDrill.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sp = new URL(req.url).searchParams
  const period = sp.get('period') || ''
  const level = Number(sp.get('level') || '1')
  const parent = sp.get('parent') || undefined

  const access = await getGeoAccess(user)
  if (!access.allowedPeriods.includes(period)) {
    return Response.json({ error: 'period-not-allowed' }, { status: 403 })
  }
  if ((parent || level > 1) && !access.canDrill) {
    return Response.json({ error: 'drill-down-requires-package' }, { status: 403 })
  }

  const data = await engineGeo<GeoMetricsResponse>('metrics', {
    period,
    segment: sp.get('segment') || 'apartment',
    operation: sp.get('operation') || 'sale',
    metric: sp.get('metric') || 'avg_price_sqm',
    level,
    parent,
  })
  return Response.json(data)
}
