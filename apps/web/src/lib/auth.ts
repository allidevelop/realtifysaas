import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '@/payload-types'

import { getPayloadClient } from './payload'

// Текущий пользователь в серверных компонентах/экшенах (ТЗ §13, auth Payload).
// Токен читаем через cookies() и передаём как Authorization: JWT — это надёжно
// работает и в RSC, и в server actions (в actions заголовки из headers() не
// всегда содержат Cookie из-за форвардинга через middleware).
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies()
  const token = store.get('payload-token')?.value
  if (!token) return null
  const payload = await getPayloadClient()
  const headers = new Headers({ Authorization: `JWT ${token}` })
  const { user } = await payload.auth({ headers })
  return (user as User | null) ?? null
}

// Авторитетная проверка: вернуть пользователя или редирект на логин.
// Используется в защищённых страницах кабинета (middleware — лишь presence-гейт).
export async function requireUser(nextPath = '/account'): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect(`/account/login?next=${encodeURIComponent(nextPath)}`)
  return user
}
