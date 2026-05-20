import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/keywords'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/static-v2-resource-policy-handler/',
          '/api/',
          '/account/',
          '/cart',
          '/checkout',
          '/auth',
          '/address-book',
        ],
      },
      // Block aggressive scrapers and AI crawlers that don't add SEO value
      {
        userAgent: ['GPTBot', 'CCBot', 'anthropic-ai', 'Claude-Web'],
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
