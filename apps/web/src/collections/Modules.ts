import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/slug'
import { anyone, isAdmin, isAdminOrEditor } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/billing/modules'

// Modules — каталог платных модулей (ТЗ §8.4). Ключи закрыты union'ом MODULE_KEYS.
export const Modules: CollectionConfig = {
  slug: 'modules',
  labels: { singular: 'Модуль', plural: 'Модули' },
  admin: {
    useAsTitle: 'name',
    group: 'Биллинг',
    defaultColumns: ['name', 'key', 'accessType', 'order', 'isActive'],
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
      name: 'key',
      type: 'select',
      required: true,
      unique: true,
      index: true,
      options: MODULE_KEYS.map((k) => ({ label: k, value: k })),
      admin: { description: 'Технический ключ модуля (неизменяемый идентификатор).' },
    },
    slugField('name'),
    { name: 'summary', type: 'textarea', localized: true },
    {
      name: 'icon',
      type: 'select',
      defaultValue: 'spark',
      options: [
        { label: 'Карта', value: 'map' },
        { label: 'Калькулятор', value: 'calc' },
        { label: 'Отчёт', value: 'report' },
        { label: 'API', value: 'api' },
        { label: 'Бот', value: 'bot' },
        { label: 'Искра', value: 'spark' },
      ],
    },
    {
      name: 'accessType',
      type: 'select',
      required: true,
      defaultValue: 'quota',
      options: [
        { label: 'Квота (число запросов)', value: 'quota' },
        { label: 'Период (по времени)', value: 'period' },
        { label: 'Бесплатно', value: 'free' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'order', type: 'number', defaultValue: 0, admin: { width: '50%' } },
        { name: 'isActive', type: 'checkbox', defaultValue: true, admin: { width: '50%' } },
      ],
    },
  ],
}
