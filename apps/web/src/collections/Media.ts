import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/lib/access'

// Media — загрузки (ТЗ §8.2). Флаг accessControlled для платных файлов — этап 5.
export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Контент' },
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'application/pdf'],
  },
  fields: [
    { name: 'alt', type: 'text', localized: true },
    {
      name: 'accessControlled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Платный/защищённый файл (выдача по токену) — логика этапа 5.',
      },
    },
  ],
}
