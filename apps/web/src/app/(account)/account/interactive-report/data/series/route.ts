import { getSeries } from '@/lib/analytics/engine'
import { getCurrentUser } from '@/lib/auth'
import { resolveModuleAccess } from '@/lib/billing/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Ряды для дашбордов. Доступ — period-entitlement (interactive-report).
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const access = await resolveModuleAccess(user, 'interactive-report')
  if (!access.allowed) return Response.json({ error: 'no-access' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const data = await getSeries({
    adminUnitId: sp.get('adminUnitId') || '',
    operation: sp.get('operation') || 'sale',
    metric: sp.get('metric') || 'avg_price_sqm',
  })
  return Response.json(data)
}
