import { getCurrentUser } from '@/lib/auth'
import { getGeoAccess, isPeriodAllowed } from '@/lib/geo/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENGINE = () => process.env.ENGINE_BASE_URL || 'http://localhost:8000'

// PDF-зріз поточного вигляду геопорталу. Гейтинг періоду — як у /data/metrics.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sp = new URL(req.url).searchParams
  const period = sp.get('period') || ''
  const access = await getGeoAccess(user)
  if (!isPeriodAllowed(access, period)) {
    return Response.json({ error: 'period-not-allowed' }, { status: 403 })
  }

  const parentRaw = sp.get('parent')
  const body = {
    period,
    segment: sp.get('segment') || 'apartment',
    operation: sp.get('operation') || 'sale',
    metric: sp.get('metric') || 'avg_price_sqm',
    level: Number(sp.get('level') || '1'),
    parent: parentRaw ? Number(parentRaw) : null,
    currency: sp.get('currency') || 'UAH',
  }

  const res = await fetch(`${ENGINE()}/api/reports/geo-portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) return new Response('Engine error', { status: 502 })

  const buf = await res.arrayBuffer()
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="geoportal-${body.metric}-${body.period}.pdf"`,
    },
  })
}
