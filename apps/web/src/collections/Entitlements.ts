import type { CollectionConfig } from 'payload'

import { isAdmin, isOwnerOrAdmin } from '@/lib/access'

// Entitlements — авторитетная запись доступа к модулю (ТЗ §8.2/§8.4).
// Поглощает «Subscriptions»: period-entitlement == подписка.
// Мутации — только серверным биллинг-кодом (overrideAccess); из админки видно,
// но создаётся/правится фулфилментом оплат.
export const Entitlements: CollectionConfig = {
  slug: 'entitlements',
  labels: { singular: 'Доступ (entitlement)', plural: 'Доступы (entitlements)' },
  admin: {
    useAsTitle: 'id',
    group: 'Биллинг',
    defaultColumns: ['user', 'module', 'accessType', 'quotaRemaining', 'periodEnd', 'status'],
  },
  access: {
    read: isOwnerOrAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'user', type: 'relationship', relationTo: 'users', index: true, admin: { width: '50%' } },
        {
          name: 'organization',
          type: 'relationship',
          relationTo: 'organizations',
          index: true,
          admin: { width: '50%', description: 'Заполняется для корпоративных доступов.' },
        },
      ],
    },
    { name: 'module', type: 'relationship', relationTo: 'modules', required: true, index: true },
    {
      name: 'accessType',
      type: 'select',
      required: true,
      options: [
        { label: 'Квота', value: 'quota' },
        { label: 'Период', value: 'period' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'quotaTotal', type: 'number', defaultValue: 0, admin: { width: '50%' } },
        {
          name: 'quotaRemaining',
          type: 'number',
          defaultValue: 0,
          index: true,
          admin: { width: '50%', description: 'БД — источник истины; Redis кэширует горячий счётчик.' },
        },
      ],
    },
    {
      name: 'periodEnd',
      type: 'date',
      index: true,
      admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Для period-доступа.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Активен', value: 'active' },
        { label: 'Исчерпан', value: 'exhausted' },
        { label: 'Истёк', value: 'expired' },
        { label: 'Отменён', value: 'canceled' },
        { label: 'Просрочен (past_due)', value: 'past_due' },
      ],
    },
    {
      name: 'cancelAtPeriodEnd',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Доступ держится до конца периода, далее — canceled.' },
    },
    {
      name: 'sourceOrders',
      type: 'relationship',
      relationTo: 'orders',
      hasMany: true,
      admin: { description: 'Заказы, продлившие этот доступ.' },
    },
    { name: 'lastConsumedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
