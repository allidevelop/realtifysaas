import type { CollectionConfig } from 'payload'

// Media — загрузки (ТЗ §8.2). Флаг accessControlled для платных файлов — этап 5.
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
  ],
  upload: true,
}
