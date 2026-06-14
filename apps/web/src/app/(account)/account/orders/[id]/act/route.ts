import { hasRole } from '@/lib/access'
import { getCurrentUser } from '@/lib/auth'
import { generateOrderDoc } from '@/lib/billing/documents'
import { getPayloadClient } from '@/lib/payload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Защищённая выдача акта (только по оплаченному заказу, owner/admin).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const payload = await getPayloadClient()
  const order = await payload
    .findByID({ collection: 'orders', id, depth: 1, overrideAccess: true })
    .catch(() => null)
  if (!order) return new Response('Not found', { status: 404 })

  const ownerId = typeof order.user === 'object' ? order.user?.id : order.user
  if (ownerId !== user.id && !hasRole(user, 'admin')) {
    return new Response('Forbidden', { status: 403 })
  }
  if (order.status !== 'paid' && order.status !== 'fulfilled') {
    return new Response('Act available after payment', { status: 409 })
  }

  const pdf = await generateOrderDoc(order, 'act')
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="act-${order.orderNumber}.pdf"`,
    },
  })
}
