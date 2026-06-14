import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '@/payload-types'

import { getPayloadClient } from './payload'

// Текущий пользователь в серверных компонентах/экшенах (ТЗ §13, auth Payload).
// Тонкая авторизация (через БД) — здесь; грубый edge-гейт — в middleware.
export async function getCurrentUser(): Promise<User | null> {
  const payload = await getPayloadClient()
  const h = await nextHeaders()
  const { user } = await payload.auth({ headers: h as unknown as Headers })
  return (user as User | null) ?? null
}

// Авторитетная проверка: вернуть пользователя или редирект на логин.
// Используется в защищённых страницах кабинета (middleware — лишь presence-гейт).
export async function requireUser(nextPath = '/account'): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect(`/account/login?next=${encodeURIComponent(nextPath)}`)
  return user
}
