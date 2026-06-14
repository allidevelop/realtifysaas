import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/slug'
import { anyone, isAdminOrEditor } from '@/lib/access'

// Tools — описания инструментов платформы (ТЗ §8.2). Витрина /tools/[slug].
export const Tools: CollectionConfig = {
  slug: 'tools',
  labels: { singular: 'Инструмент', plural: 'Инструменты' },
  admin: {
    useAsTitle: 'title',
    group: 'Контент',
    defaultColumns: ['title', 'slug', 'order', 'isActive'],
  },
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField('title'),
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      localized: true,
      admin: { description: 'Короткое описание для карточки.' },
    },
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
    { name: 'content', type: 'richText', localized: true },
    {
      type: 'row',
      fields: [
        {
          name: 'order',
          type: 'number',
          defaultValue: 0,
          admin: { width: '50%', description: 'Порядок сортировки.' },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: { width: '50%' },
        },
      ],
    },
  ],
}
