import type { Block } from 'payload'

// CTABlock (ТЗ §8.3) — призыв к действию (подписка/контакт).
export const CTA: Block = {
  slug: 'cta',
  interfaceName: 'CTABlock',
  labels: { singular: 'Призыв к действию', plural: 'Призывы к действию' },
  fields: [
    { name: 'heading', type: 'text', required: true, localized: true },
    { name: 'text', type: 'textarea', localized: true },
    {
      type: 'row',
      fields: [
        { name: 'buttonLabel', type: 'text', localized: true, admin: { width: '50%' } },
        { name: 'buttonHref', type: 'text', admin: { width: '50%' } },
      ],
    },
  ],
}
