'use server'

import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Organization } from '@/payload-types'

import type { Payload } from 'payload'

// Места по умолчанию при создании организации (поднимается тарифом/админом).
const DEFAULT_SEATS = 5

function idOf(ref: number | string | { id: number | string } | null | undefined): number | null {
  if (ref == null) return null
  if (typeof ref === 'number') return ref
  if (typeof ref === 'string') return Number(ref)
  return typeof ref.id === 'number' ? ref.id : Number(ref.id)
}

// Организация, которой владеет пользователь (он — её администратор мест).
async function ownedOrg(payload: Payload, userId: number): Promise<Organization | null> {
  const res = await payload.find({
    collection: 'organizations',
    where: { owner: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}

function memberIds(org: Organization): number[] {
  return (org.members ?? []).map(idOf).filter((x): x is number => typeof x === 'number')
}

// Создать организацию: текущий пользователь — владелец и первый участник.
export async function createOrgAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect('/account/login')

  const name = String(formData.get('name') ?? '').trim()
  const edrpou = String(formData.get('edrpou') ?? '').trim() || undefined
  if (!name) redirect('/account/organization?error=name')

  const payload = await getPayloadClient()
  if (await ownedOrg(payload, user.id)) redirect('/account/organization') // уже есть

  const org = await payload.create({
    collection: 'organizations',
    overrideAccess: true,
    data: {
      name,
      edrpou,
      billingEmail: user.email,
      owner: user.id,
      members: [user.id],
      seatsLimit: DEFAULT_SEATS,
    },
  })
  // Привязать владельца к организации, чтобы он наследовал общие доступы.
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { organization: org.id },
  })
  redirect('/account/organization?ok=created')
}

// Добавить участника по email (в пределах seatsLimit).
export async function addMemberAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect('/account/login')

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const payload = await getPayloadClient()
  const org = await ownedOrg(payload, user.id)
  if (!org) redirect('/account/organization?error=noorg')
  if (!email) redirect('/account/organization?error=email')

  const members = memberIds(org)
  const seats = org.seatsLimit ?? DEFAULT_SEATS
  if (members.length >= seats) redirect('/account/organization?error=seats')

  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  const target = found.docs[0]
  if (!target) redirect('/account/organization?error=notfound')
  if (members.includes(target.id)) redirect('/account/organization?error=dup')
  // Уже состоит в другой организации — нельзя «переманить» молча.
  const targetOrg = idOf(target.organization)
  if (targetOrg && targetOrg !== org.id) redirect('/account/organization?error=otherorg')

  await payload.update({
    collection: 'organizations',
    id: org.id,
    overrideAccess: true,
    data: { members: [...members, target.id] },
  })
  await payload.update({
    collection: 'users',
    id: target.id,
    overrideAccess: true,
    data: { organization: org.id },
  })
  redirect('/account/organization?ok=added')
}

// Убрать участника (владельца убрать нельзя).
export async function removeMemberAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect('/account/login')

  const memberId = Number(formData.get('memberId'))
  const payload = await getPayloadClient()
  const org = await ownedOrg(payload, user.id)
  if (!org) redirect('/account/organization?error=noorg')
  if (!Number.isFinite(memberId)) redirect('/account/organization')
  if (idOf(org.owner) === memberId) redirect('/account/organization?error=owner')

  const members = memberIds(org).filter((id) => id !== memberId)
  await payload.update({
    collection: 'organizations',
    id: org.id,
    overrideAccess: true,
    data: { members },
  })
  // Снять привязку, если пользователь указывал на эту организацию.
  const target = await payload
    .findByID({ collection: 'users', id: memberId, overrideAccess: true })
    .catch(() => null)
  if (target && idOf(target.organization) === org.id) {
    await payload.update({
      collection: 'users',
      id: memberId,
      overrideAccess: true,
      data: { organization: null },
    })
  }
  redirect('/account/organization?ok=removed')
}
