import type { Metadata } from 'next'

import { SITE_NAME, SITE_URL } from './constants'

// Единая сборка метаданных (ТЗ §13): canonical, OpenGraph, Twitter.
export function buildMetadata({
  title,
  description,
  path = '/',
  image,
}: {
  title?: string | null
  description?: string | null
  path?: string
  image?: string | null
}): Metadata {
  const url = new URL(path, SITE_URL).toString()
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — геоаналитика недвижимости`
  const desc = description || undefined
  const images = image ? [{ url: image }] : undefined

  return {
    title: fullTitle,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description: desc,
      url,
      siteName: SITE_NAME,
      locale: 'uk_UA',
      type: 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: desc,
      images: image ? [image] : undefined,
    },
  }
}
