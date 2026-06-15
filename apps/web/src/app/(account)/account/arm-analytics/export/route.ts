import { searchListings, type Listing } from '@/lib/analytics/engine'
import { getCurrentUser } from '@/lib/auth'
import { consumeQuota } from '@/lib/billing/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(items: Listing[]): string {
  const head = ['id', 'segment', 'operation', 'area', 'price', 'pricePerSqm', 'currency', 'published', 'unit']
  const lines = [head.join(';')]
  for (const it of items) {
    lines.push(
      [it.id, it.segment, it.operation, it.area, it.price, it.pricePerSqm, it.currency, it.published, it.unit]
        .map(csvCell)
        .join(';'),
    )
  }
  return '﻿' + lines.join('\n') // BOM для Excel/кириллицы
}

// Экспорт объявлений в CSV (списывает квоту arm-analytics). Обычная форма-POST.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  const back = (p: string) => Response.redirect(new URL(p, req.url), 303)
  if (!user) return back('/account/login')

  const form = await req.formData()
  const q = await consumeQuota(user, 'arm-analytics', {
    runId: String(form.get('runId') ?? '') || undefined,
  })
  if (!q.ok) return back('/account/arm-analytics?error=quota')

  const data = await searchListings({
    adminUnitId: String(form.get('adminUnitId') ?? '') || undefined,
    segment: String(form.get('segment') ?? '') || undefined,
    operation: String(form.get('operation') ?? '') || undefined,
    areaMin: String(form.get('areaMin') ?? '') || undefined,
    areaMax: String(form.get('areaMax') ?? '') || undefined,
    priceMin: String(form.get('priceMin') ?? '') || undefined,
    priceMax: String(form.get('priceMax') ?? '') || undefined,
    limit: 500,
  })

  return new Response(toCsv(data.items), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="listings.csv"',
    },
  })
}
