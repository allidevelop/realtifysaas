import type { Access, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

type Role = NonNullable<User['roles']>[number]

export function hasRole(user: unknown, ...roles: Role[]): boolean {
  const u = user as User | null | undefined
  if (!u?.roles) return false
  return roles.some((r) => u.roles?.includes(r))
}

// Доступ к чтению: админ/редактор. Для коллекций контента (ТЗ §8, §13).
export const isAdmin: Access = ({ req }) => hasRole(req.user, 'admin')

export const isAdminOrEditor: Access = ({ req }) => hasRole(req.user, 'admin', 'editor')

export const isAdminFieldLevel: FieldAccess = ({ req }) => hasRole(req.user, 'admin')

// Публичное чтение только опубликованных (для коллекций с drafts); авторизованным — всё.
export const publishedOrSignedIn: Access = ({ req }) => {
  if (req.user) return true
  return {
    _status: {
      equals: 'published',
    },
  }
}

export const anyone: Access = () => true

export const isSignedIn: Access = ({ req }) => Boolean(req.user)

// Биллинг: владелец записи или админ. Не-админ видит только свои записи
// (фильтр по полю `user`). Org-доступ уточняется позже (seats, этап 6).
export const isOwnerOrAdmin: Access = ({ req }) => {
  if (!req.user) return false
  if (hasRole(req.user, 'admin')) return true
  return {
    user: {
      equals: req.user.id,
    },
  }
}
