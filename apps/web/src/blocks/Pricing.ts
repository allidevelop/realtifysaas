import type { Block } from 'payload'

// PricingBlock (ТЗ §8.3) — тарифы из коллекции ServicePlans (CMS — источник истины).
export const Pricing: Block = {
  slug: 'pricing',
  interfaceName: 'PricingBlock',
  labels: { singular: 'Тарифы', plural: 'Блоки тарифов' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    { name: 'intro', type: 'textarea', localized: true },
    {
      name: 'note',
      type: 'text',
      localized: true,
      admin: { description: 'Сноска под тарифами (напр. про безнал для юрлиц).' },
    },
  ],
}
