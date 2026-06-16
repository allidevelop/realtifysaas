import { autovalueFetch, autovalueLogin, type AutovalueJob } from '@/lib/autovalue'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Статус задания автооценки (прокси к autovalue /api/jobs/{id}).
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const jobId = new URL(req.url).searchParams.get('job') || ''
  if (!/^[0-9_a-f]+$/i.test(jobId)) return Response.json({ error: 'bad job id' }, { status: 400 })

  let cookie: string
  try {
    cookie = await autovalueLogin()
  } catch {
    return Response.json({ error: 'Сервіс автооцінки недоступний.' }, { status: 502 })
  }

  const res = await autovalueFetch(`/api/jobs/${jobId}`, cookie)
  if (!res.ok) return Response.json({ error: 'not-found' }, { status: res.status })
  const job = (await res.json()) as AutovalueJob
  return Response.json({
    id: job.id,
    status: job.status,
    error: job.error,
    events: (job.events ?? []).slice(-40),
    artifacts: (job.artifacts ?? []).map((a) => ({ name: a.name, kind: a.kind, size: a.size })),
  })
}
