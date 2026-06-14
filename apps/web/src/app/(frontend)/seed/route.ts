import { NextResponse } from 'next/server'

import { getPayloadClient } from '@/lib/payload'
import { runSeed } from '@/seed/seed'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// GET /seed?secret=$PAYLOAD_SECRET — наполнить CMS демо-контентом (этап 1).
// Гард по секрету: без верного secret — 401. Идемпотентно.
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (!process.env.PAYLOAD_SECRET || secret !== process.env.PAYLOAD_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const payload = await getPayloadClient()
    const result = await runSeed(payload)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'seed failed' },
      { status: 500 },
    )
  }
}
