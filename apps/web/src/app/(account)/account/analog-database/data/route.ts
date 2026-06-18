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
  if (url.searchParams.get('type') === 'screenshot') {
    const id = url.searchParams.get('id') || ''
    const cookie = await autovalueLogin()
    const res = await autovalueFetch(`/api/analogs/${encodeURIComponent(id)}/screenshot`, cookie)
    if (!res.ok) return new Response('not found', { status: res.status })
    const buf = await res.arrayBuffer()
    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': res.headers.get('content-type') || 'image/png',
        'cache-control': 'private, max-age=3600',
      },
    })
  }
  if (url.searchParams.get('type') === 'job-status') {
    const id = url.searchParams.get('id') || ''
    if (!/^[0-9a-z_]+$/i.test(id)) return new Response(JSON.stringify({ error: 'bad job id' }), { status: 400 })
    const cookie = await autovalueLogin()
    const res = await autovalueFetch(`/api/jobs/${id}`, cookie)
    if (!res.ok) return new Response(JSON.stringify({ error: 'not-found' }), { status: res.status })
    const job = await res.json()
    return new Response(
      JSON.stringify({ id: job.id, status: job.status, error: job.error, events: (job.events ?? []).slice(-40) }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  const ak = url.searchParams.get('address_key') || ''
  return proxy(`/api/analogs?address_key=${encodeURIComponent(ak)}`)
}

export async function POST(req: Request): Promise<Response> {
  const gate = await ensureUser()
  if (gate) return gate
  const url = new URL(req.url)
  const type = url.searchParams.get('type')

  if (type === 'screenshot') {
    const id = url.searchParams.get('id')
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })
    const inForm = await req.formData()
    const file = inForm.get('file')
    if (!(file instanceof Blob)) return new Response(JSON.stringify({ error: 'file required' }), { status: 400 })
    const out = new FormData()
    out.append('file', file, (file as File).name || 'screenshot.png')
    const cookie = await autovalueLogin()
    const res = await autovalueFetch(`/api/analogs/${encodeURIComponent(id)}/screenshot`, cookie, {
      method: 'POST',
      body: out,
    })
    const text = await res.text()
    return new Response(text, { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8' } })
  }

  if (type === 'from-url') {
    const body = await req.text()
    return proxy('/api/analogs/from-url', { method: 'POST', body, headers: { 'content-type': 'application/json' } })
  }

  if (type === 'import-library') {
    const inForm = await req.formData()
    const file = inForm.get('library_file')
    if (!(file instanceof Blob)) return new Response(JSON.stringify({ error: 'Файл бібліотеки обовʼязковий.' }), { status: 400 })
    const out = new FormData()
    out.append('library_file', file, (file as File).name || 'library.csv')
    const cookie = await autovalueLogin()
    const res = await autovalueFetch('/api/library/import', cookie, { method: 'POST', body: out })
    const text = await res.text()
    try {
      const job = JSON.parse(text)
      return new Response(JSON.stringify({ jobId: job.id, status: job.status }), {
        status: res.status,
        headers: { 'content-type': 'application/json' },
      })
    } catch {
      return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } })
    }
  }

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
