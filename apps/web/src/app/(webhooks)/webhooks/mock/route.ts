import { NextResponse } from 'next/server'

import { handleProviderWebhook } from '@/lib/billing/webhook'

// Вебхук мок-провайдера (локальный e2e). Путь вне /api, чтобы не конфликтовать
// с Payload api/[...slug]. Подпись X-Mock-Sign + идемпотентность.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const raw = await req.text()
  const res = await handleProviderWebhook('mock', raw, req.headers)
  return NextResponse.json(res.body, { status: res.httpStatus })
}
