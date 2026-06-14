import type { CollectionConfig } from 'payload'

import { hasRole, isAdmin } from '@/lib/access'

// Organizations — корпоративные/банковские аккаунты (ТЗ §8.2). В этой фазе —
// контейнер для реквизитов юрлица (безнал) и будущих мест (seats, этап 6).
export const Organizations: CollectionConfig = {
  slug: 'organizations',
  labels: { singular: 'Организация', plural: 'Организации' },
  admin: {
    useAsTitle: 'name',
    group: 'Биллинг',
    defaultColumns: ['name', 'edrpou', 'seatsLimit'],
  },
  access: {
    // Чтение — член организации или админ. Создание/правка — админ (в этой фазе).
    read: ({ req }) => {
      if (!req.user) return false
      if (hasRole(req.user, 'admin')) return true
      return { members: { in: [req.user.id] } }
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'edrpou', type: 'text', admin: { width: '50%', description: 'ЄДРПОУ' } },
        { name: 'ipn', type: 'text', admin: { width: '50%', description: 'ІПН' } },
      ],
    },
    { name: 'billingEmail', type: 'email' },
    { name: 'owner', type: 'relationship', relationTo: 'users' },
    { name: 'members', type: 'relationship', relationTo: 'users', hasMany: true },
    {
      name: 'seatsLimit',
      type: 'number',
      defaultValue: 1,
      admin: { description: 'Лимит мест (из тарифа); логика seats — этап 6.' },
    },
  ],
}
