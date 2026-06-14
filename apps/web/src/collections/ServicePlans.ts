import type { CollectionConfig } from 'payload'

import { anyone, isAdmin, isAdminOrEditor } from '@/lib/access'

// ServicePlans — КАТАЛОГ ПАКЕТОВ доступа к модулям (ТЗ §2, §8.2; модель «пакеты
// квот по модулям», как у конкурента). Каждая запись = один пакет одного модуля
// (или бандла). Источник истины для /pricing, PricingBlock и фулфилмента оплат.
// Деньги — priceMinor (копейки). price/currency — для отображения.
export const ServicePlans: CollectionConfig = {
  slug: 'service-plans',
  labels: { singular: 'Пакет', plural: 'Пакеты' },
  admin: {
    useAsTitle: 'name',
    group: 'Биллинг',
    defaultColumns: ['name', 'module', 'accessType', 'quota', 'periodDays', 'price', 'isActive'],
  },
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'modules',
      required: true,
      index: true,
      admin: { description: 'Модуль, к которому даёт доступ пакет.' },
    },
    {
      name: 'grantsModules',
      type: 'relationship',
      relationTo: 'modules',
      hasMany: true,
      admin: { description: 'Доп. модули бандла (напр. калькулятор + АРМ Аналітика).' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'accessType',
          type: 'select',
          required: true,
          defaultValue: 'quota',
          options: [
            { label: 'Квота (число запросов)', value: 'quota' },
            { label: 'Период (по времени)', value: 'period' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'packLevel',
          type: 'select',
          options: [
            { label: 'Минимальный', value: 'min' },
            { label: 'Средний', value: 'mid' },
            { label: 'Максимальный', value: 'max' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'quota',
          type: 'number',
          min: 0,
          admin: {
            width: '50%',
            description: 'Число запросов в пакете.',
            condition: (data) => data?.accessType === 'quota',
          },
        },
        {
          name: 'periodDays',
          type: 'number',
          min: 1,
          admin: {
            width: '50%',
            description: 'Длительность доступа, дней.',
            condition: (data) => data?.accessType === 'period',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'priceMinor',
          type: 'number',
          required: true,
          min: 0,
          admin: { width: '34%', description: 'Цена в копейках (источник истины).' },
        },
        {
          name: 'price',
          type: 'number',
          required: true,
          min: 0,
          admin: { width: '33%', description: 'Цена для отображения (грн).' },
        },
        {
          name: 'currency',
          type: 'select',
          required: true,
          defaultValue: 'UAH',
          options: ['UAH', 'USD', 'EUR'],
          admin: { width: '33%' },
        },
      ],
    },
    {
      name: 'tagline',
      type: 'text',
      localized: true,
      admin: { description: 'Короткий подзаголовок пакета.' },
    },
    {
      name: 'features',
      type: 'array',
      labels: { singular: 'Возможность', plural: 'Возможности' },
      fields: [{ name: 'label', type: 'text', required: true, localized: true }],
    },
    {
      // Оставлено для текущего PlanCard; period-пакеты — 'one-time' по смыслу.
      name: 'billingPeriod',
      type: 'select',
      defaultValue: 'one-time',
      options: [
        { label: 'В месяц', value: 'month' },
        { label: 'В год', value: 'year' },
        { label: 'Разово', value: 'one-time' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'seats', type: 'number', defaultValue: 1, admin: { position: 'sidebar', description: 'Число мест (для корп.).' } },
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
      admin: { description: 'Надпись на кнопке (по умолчанию «Купить»).' },
    },
  ],
}
