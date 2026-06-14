import type { CollectionConfig } from 'payload'

import { anyone, isAdmin, isAdminOrEditor } from '@/lib/access'

// ServicePlans — тарифы подписки (ТЗ §2, §8.2). Источник истины для /pricing и
// PricingBlock. Гейтинг доступа по этим лимитам — этап 5.
export const ServicePlans: CollectionConfig = {
  slug: 'service-plans',
  labels: { singular: 'Тариф', plural: 'Тарифы' },
  admin: {
    useAsTitle: 'name',
    group: 'Биллинг',
    defaultColumns: ['name', 'tier', 'price', 'billingPeriod', 'isActive', 'order'],
  },
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    // Удаление тарифа влияет на подписки — только админ.
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    {
      name: 'tier',
      type: 'select',
      required: true,
      defaultValue: 'basic',
      options: [
        { label: 'Тест', value: 'test' },
        { label: 'Базовый', value: 'basic' },
        { label: 'Профи', value: 'pro' },
        { label: 'Корпоративный', value: 'corporate' },
      ],
    },
    {
      name: 'tagline',
      type: 'text',
      localized: true,
      admin: { description: 'Короткий подзаголовок тарифа.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'price', type: 'number', required: true, min: 0, admin: { width: '50%' } },
        {
          name: 'currency',
          type: 'select',
          required: true,
          defaultValue: 'UAH',
          options: ['UAH', 'USD', 'EUR'],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'billingPeriod',
      type: 'select',
      required: true,
      defaultValue: 'month',
      options: [
        { label: 'В месяц', value: 'month' },
        { label: 'В год', value: 'year' },
        { label: 'Разово', value: 'one-time' },
      ],
    },
    {
      type: 'collapsible',
      label: 'Лимиты и возможности',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'requestLimit',
              type: 'number',
              defaultValue: 0,
              admin: { width: '50%', description: 'Запросов оценки в период (0 — без оценки).' },
            },
            {
              name: 'historyDepthMonths',
              type: 'number',
              defaultValue: 0,
              admin: { width: '50%', description: 'Глубина ретроспективы, мес.' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'exportEnabled', type: 'checkbox', defaultValue: false, admin: { width: '33%' } },
            { name: 'apiAccess', type: 'checkbox', defaultValue: false, admin: { width: '33%' } },
            {
              name: 'seats',
              type: 'number',
              defaultValue: 1,
              admin: { width: '34%', description: 'Число мест (для корп.).' },
            },
          ],
        },
        {
          name: 'features',
          type: 'array',
          labels: { singular: 'Возможность', plural: 'Возможности' },
          fields: [{ name: 'label', type: 'text', required: true, localized: true }],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'highlighted', type: 'checkbox', defaultValue: false, admin: { width: '33%', description: 'Выделить как популярный.' } },
        { name: 'order', type: 'number', defaultValue: 0, admin: { width: '33%' } },
        { name: 'isActive', type: 'checkbox', defaultValue: true, admin: { width: '34%' } },
      ],
    },
    {
      name: 'ctaLabel',
      type: 'text',
      localized: true,
      admin: { description: 'Надпись на кнопке (по умолчанию «Выбрать»).' },
    },
  ],
}
