import { NextResponse } from 'next/server'

import { processRenewals } from '@/lib/billing/renewals'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// GET|POST /cron/renewals?secret=... — прогон авто-рекуррента/dunning (ТЗ §11).
// Гард по секрету CRON_SECRET (или PAYLOAD_SECRET). Идемпотентно по сути:
// active продлевается лишь в окне, past_due — по грейсу. Для теста принимает
// renewWindowDays, graceDays, now (ms).
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  const expected = process.env.CRON_SECRET || process.env.PAYLOAD_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const numParam = (k: string): number | undefined => {
    const v = url.searchParams.get(k)
    if (v == null) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  try {
    const report = await processRenewals({
      now: numParam('now'),
      renewWindowDays: numParam('renewWindowDays'),
      graceDays: numParam('graceDays'),
    })
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'renewals failed' },
      { status: 500 },
    )
  }
}

export const GET = handle
export const POST = handle
