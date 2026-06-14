import type { Block } from 'payload'

// RichTextBlock (ТЗ §8.3) — произвольный форматированный контент (lexical).
export const RichTextBlock: Block = {
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  labels: { singular: 'Текстовый блок', plural: 'Текстовые блоки' },
  fields: [
    { name: 'content', type: 'richText', required: true, localized: true },
    {
      name: 'width',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: 'Обычная', value: 'normal' },
        { label: 'Узкая', value: 'narrow' },
      ],
    },
  ],
}
