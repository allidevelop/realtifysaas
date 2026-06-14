import type { Block } from 'payload'

// ToolsBlock (ТЗ §8.3) — витрина инструментов из коллекции Tools.
export const ToolsShowcase: Block = {
  slug: 'toolsShowcase',
  interfaceName: 'ToolsBlock',
  labels: { singular: 'Витрина инструментов', plural: 'Витрины инструментов' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    { name: 'intro', type: 'textarea', localized: true },
    {
      name: 'tools',
      type: 'relationship',
      relationTo: 'tools',
      hasMany: true,
      admin: {
        description: 'Если пусто — покажем все активные инструменты по порядку.',
      },
    },
  ],
}
