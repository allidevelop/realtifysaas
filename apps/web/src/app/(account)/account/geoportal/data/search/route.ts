import { getCurrentUser } from '@/lib/auth'
import { engineGeo } from '@/lib/geo/engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SearchResp {
  items: { id: number; name: string; level: number; parentId: number | null; bbox: number[] }[]
}

// Прокси поиска АТЕ по названию.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const q = new URL(req.url).searchParams.get('q') || ''
  if (q.length < 2) return Response.json({ items: [] })
  const data = await engineGeo<SearchResp>('search', { q, limit: 10 })
  return Response.json(data)
}
