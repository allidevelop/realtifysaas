import type { Block } from 'payload'

// FeatureGridBlock (ТЗ §8.3) — сетка преимуществ/возможностей.
export const FeatureGrid: Block = {
  slug: 'featureGrid',
  interfaceName: 'FeatureGridBlock',
  labels: { singular: 'Сетка возможностей', plural: 'Сетки возможностей' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    { name: 'intro', type: 'textarea', localized: true },
    {
      name: 'features',
      type: 'array',
      minRows: 1,
      maxRows: 12,
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'description', type: 'textarea', localized: true },
        {
          name: 'icon',
          type: 'select',
          defaultValue: 'spark',
          options: [
            { label: 'Карта', value: 'map' },
            { label: 'Калькулятор', value: 'calc' },
            { label: 'Отчёт', value: 'report' },
            { label: 'API', value: 'api' },
            { label: 'Бот', value: 'bot' },
            { label: 'Искра', value: 'spark' },
          ],
        },
      ],
    },
  ],
}
