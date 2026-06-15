import { getCurrentUser } from '@/lib/auth'
import { getGeoAccess } from '@/lib/geo/access'
import { engineGeo } from '@/lib/geo/engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Прокси GeoJSON границ + freemium: drill-down (level>1) — только при canDrill.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sp = new URL(req.url).searchParams
  const level = Number(sp.get('level') || '1')
  const parent = sp.get('parent') || undefined

  if (parent || level > 1) {
    const access = await getGeoAccess(user)
    if (!access.canDrill) {
      return Response.json({ error: 'drill-down-requires-package' }, { status: 403 })
    }
  }

  const fc = await engineGeo('units', {
    level,
    parent,
    simplify: sp.get('simplify') || undefined,
  })
  return Response.json(fc)
}
