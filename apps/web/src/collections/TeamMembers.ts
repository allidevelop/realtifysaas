import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/lib/access'

// TeamMembers — команда (ТЗ §8.2). Рендерится TeamBlock.
export const TeamMembers: CollectionConfig = {
  slug: 'team-members',
  labels: { singular: 'Сотрудник', plural: 'Команда' },
  admin: {
    useAsTitle: 'name',
    group: 'Контент',
    defaultColumns: ['name', 'role', 'order'],
  },
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'text', localized: true },
    { name: 'bio', type: 'textarea', localized: true },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
  ],
}
