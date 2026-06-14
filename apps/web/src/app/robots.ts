import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/constants'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/api'],
    },
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
  }
}
