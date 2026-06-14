import type { Block } from 'payload'

// HeroBlock (ТЗ §8.3) — первый экран: заголовок, подзаголовок, CTA.
export const Hero: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  labels: { singular: 'Hero', plural: 'Hero-блоки' },
  fields: [
    { name: 'heading', type: 'text', required: true, localized: true },
    { name: 'subheading', type: 'textarea', localized: true },
    {
      type: 'row',
      fields: [
        { name: 'ctaLabel', type: 'text', localized: true, admin: { width: '50%' } },
        { name: 'ctaHref', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'secondaryLabel', type: 'text', localized: true, admin: { width: '50%' } },
        { name: 'secondaryHref', type: 'text', admin: { width: '50%' } },
      ],
    },
  ],
}
