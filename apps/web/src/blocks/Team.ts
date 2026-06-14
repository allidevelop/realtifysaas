import type { Block } from 'payload'

// TeamBlock (ТЗ §8.3) — команда из коллекции TeamMembers.
export const Team: Block = {
  slug: 'team',
  interfaceName: 'TeamBlock',
  labels: { singular: 'Команда', plural: 'Блоки команды' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    { name: 'intro', type: 'textarea', localized: true },
  ],
}
