import { autovalueFetch, autovalueLogin } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Скачивание артефакта задания (прокси к autovalue /api/jobs/{id}/files/{name}).
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const sp = new URL(req.url).searchParams
  const jobId = sp.get('job') || ''
  const name = sp.get('name') || ''
  if (!/^[0-9_a-f]+$/i.test(jobId) || !/^[\w.\- ]+$/.test(name)) {
    return new Response('bad request', { status: 400 })
  }

  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return new Response('autovalue unavailable', { status: 502 })
  }

  const res = await autovalueFetch(`/api/jobs/${jobId}/files/${encodeURIComponent(name)}`, cookie)
  if (!res.ok) return new Response('not found', { status: res.status })

  const buf = await res.arrayBuffer()
  return new Response(buf, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
