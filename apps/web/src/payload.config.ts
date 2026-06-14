// Payload CMS 3 — конфигурация (ТЗ §8, §13).
// Этап 1: контент-коллекции, блоки, тарифы, локализация uk/en, SEO-плагин.
// БД: схема public (Payload); схема gis (PostGIS) — отдельно (этап 2).

import { postgresAdapter } from '@payloadcms/db-postgres'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Entitlements } from './collections/Entitlements'
import { Media } from './collections/Media'
import { Modules } from './collections/Modules'
import { News } from './collections/News'
import { Orders } from './collections/Orders'
import { Organizations } from './collections/Organizations'
import { Pages } from './collections/Pages'
import { Partners } from './collections/Partners'
import { PaymentEvents } from './collections/PaymentEvents'
import { ServicePlans } from './collections/ServicePlans'
import { TeamMembers } from './collections/TeamMembers'
import { Tools } from './collections/Tools'
import { Users } from './collections/Users'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— Realtify CMS',
    },
  },
  collections: [
    // Контент
    Pages,
    News,
    Tools,
    TeamMembers,
    Partners,
    Media,
    // Биллинг
    Modules,
    ServicePlans,
    Entitlements,
    Orders,
    Organizations,
    PaymentEvents,
    // Доступ
    Users,
  ],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  localization: {
    locales: [
      { label: 'Українська', code: 'uk' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'uk',
    fallback: true,
  },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  plugins: [
    seoPlugin({
      collections: ['pages', 'news', 'tools'],
      uploadsCollection: 'media',
      tabbedUI: true,
      generateTitle: ({ doc }: { doc: { title?: string } }) =>
        doc?.title ? `${doc.title} — Realtify` : 'Realtify',
      generateDescription: ({ doc }: { doc: { excerpt?: string; summary?: string } }) =>
        doc?.excerpt || doc?.summary || '',
    }),
  ],
  sharp,
})
