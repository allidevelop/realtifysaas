import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminFieldLevel } from '@/lib/access'

// Users — auth-коллекция (ТЗ §8.2). Роли: admin/editor/customer/api.
// Организации/подписки расширяются на этапе 5.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'Доступ',
    defaultColumns: ['email', 'roles'],
  },
  auth: true,
  access: {
    // Управление пользователями — только админ; себя читать может каждый авторизованный.
    read: ({ req }) => {
      if (!req.user) return false
      return true
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['customer'],
      access: {
        // Менять роли может только админ.
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      options: [
        { label: 'Администратор', value: 'admin' },
        { label: 'Редактор', value: 'editor' },
        { label: 'Клиент', value: 'customer' },
        { label: 'API', value: 'api' },
      ],
    },
  ],
}
