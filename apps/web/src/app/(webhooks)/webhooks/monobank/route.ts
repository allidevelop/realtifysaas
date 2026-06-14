import { NextResponse } from 'next/server'

import { handleProviderWebhook } from '@/lib/billing/webhook'

// Вебхук Monobank Acquiring (ТЗ §11). ECDSA X-Sign + идемпотентность.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const raw = await req.text()
  const res = await handleProviderWebhook('monobank', raw, req.headers)
  return NextResponse.json(res.body, { status: res.httpStatus })
}
