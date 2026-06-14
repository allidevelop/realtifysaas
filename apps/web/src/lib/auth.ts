import { headers as nextHeaders } from 'next/headers'

import type { User } from '@/payload-types'

import { getPayloadClient } from './payload'

// Текущий пользователь в серверных компонентах/экшенах (ТЗ §13, auth Payload).
// Тонкая авторизация (через БД) — здесь; грубый edge-гейт — в middleware (M4).
export async function getCurrentUser(): Promise<User | null> {
  const payload = await getPayloadClient()
  const h = await nextHeaders()
  const { user } = await payload.auth({ headers: h as unknown as Headers })
  return (user as User | null) ?? null
}
