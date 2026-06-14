import type { CollectionConfig } from 'payload'

import { layoutBlocks } from '@/blocks'
import { slugField } from '@/fields/slug'
import { isAdminOrEditor, publishedOrSignedIn } from '@/lib/access'

// Pages — страницы-конструкторы из блоков (ТЗ §8.2/§8.3).
// Используются для /, /about, /contacts, /legal/* и любых лендингов.
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    group: 'Контент',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
  },
  versions: {
    drafts: true,
    maxPerDoc: 20,
  },
  access: {
    read: publishedOrSignedIn,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField('title'),
    {
      name: 'section',
      type: 'select',
      defaultValue: 'general',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'general → /slug; legal → /legal/slug (оферта, политика).',
      },
      options: [
        { label: 'Обычная', value: 'general' },
        { label: 'Юридическая', value: 'legal' },
      ],
    },
    {
      name: 'layout',
      type: 'blocks',
      required: true,
      blocks: layoutBlocks,
      admin: { description: 'Соберите страницу из блоков (ТЗ §8.3).' },
    },
  ],
}
