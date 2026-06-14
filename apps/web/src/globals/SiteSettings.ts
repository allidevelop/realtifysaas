import type { GlobalConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/lib/access'

// SiteSettings — глобальные настройки сайта (ТЗ §8): навигация и контакты.
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Настройки сайта',
  admin: { group: 'Настройки' },
  access: {
    read: anyone,
    update: isAdminOrEditor,
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
      defaultValue: 'Realtify',
    },
    {
      name: 'tagline',
      type: 'text',
      localized: true,
      defaultValue: 'Геоаналитика рынка недвижимости',
    },
    {
      name: 'headerNav',
      type: 'array',
      label: 'Меню (шапка)',
      labels: { singular: 'Пункт', plural: 'Пункты' },
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'href', type: 'text', required: true },
      ],
    },
    {
      name: 'footerNav',
      type: 'array',
      label: 'Меню (подвал)',
      labels: { singular: 'Пункт', plural: 'Пункты' },
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'href', type: 'text', required: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Контакты',
      fields: [
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'text' },
        { name: 'address', type: 'textarea', localized: true },
        {
          name: 'telegram',
          type: 'text',
          admin: { description: 'Ссылка на Telegram-бот/канал.' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'CTA в подвале',
      fields: [
        { name: 'footerCtaText', type: 'text', localized: true },
        { name: 'footerCtaLabel', type: 'text', localized: true },
        { name: 'footerCtaHref', type: 'text' },
      ],
    },
  ],
}
