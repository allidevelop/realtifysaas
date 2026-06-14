import type { Block } from 'payload'

// PartnersBlock (ТЗ §8.3) — логотипы партнёров из коллекции Partners.
export const Partners: Block = {
  slug: 'partners',
  interfaceName: 'PartnersBlock',
  labels: { singular: 'Партнёры', plural: 'Блоки партнёров' },
  fields: [{ name: 'heading', type: 'text', localized: true }],
}
