import { autovalueFetch, autovalueLogin } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Проксі-міст до autovalue /api/analogs (CRUD бази аналогів). Лише серверний код кабінету.

async function proxy(path: string, init?: RequestInit): Promise<Response> {
  const cookie = await autovalueLogin()
  const res = await autovalueFetch(path, cookie, init)
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function ensureUser(): Promise<Response | null> {
  const user = await getCurrentUser()
  return user ? null : new Response('Unauthorized', { status: 401 })
}

export async function GET(req: Request): Promise<Response> {
  const gate = await ensureUser()
  if (gate) return gate
  const url = new URL(req.url)
  if (url.searchParams.get('type') === 'groups') {
    return proxy('/api/analogs/groups')
  }
  const ak = url.searchParams.get('address_key') || ''
  return proxy(`/api/analogs?address_key=${encodeURIComponent(ak)}`)
}

export async function POST(req: Request): Promise<Response> {
  const gate = await ensureUser()
  if (gate) return gate
  const body = await req.text()
  return proxy('/api/analogs', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  })
}

export async function PUT(req: Request): Promise<Response> {
  const gate = await ensureUser()
  if (gate) return gate
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })
  const body = await req.text()
  return proxy(`/api/analogs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
    headers: { 'content-type': 'application/json' },
  })
}

export async function DELETE(req: Request): Promise<Response> {
  const gate = await ensureUser()
  if (gate) return gate
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })
  return proxy(`/api/analogs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
