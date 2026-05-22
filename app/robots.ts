import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/keywords'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          // Public read-only data endpoints needed for client-side rendering
          '/api/collections',
          '/api/categories',
          '/api/products',
          '/api/homepage-curation',
          '/api/reviews',
        ],
        disallow: [
          '/admin/',
          '/static-v2-resource-policy-handler/',
          '/api/cart',
          '/api/wishlist',
          '/api/orders',
          '/api/user/',
          '/api/auth/',
          '/api/payment/',
          '/api/admin/',
          '/api/shiprocket/',
          '/api/upload',
          '/api/contact',
          '/api/newsletter/',
          '/api/fulfillment',
          '/api/delivery/',
          '/account/',
          '/cart',
          '/checkout',
          '/auth',
          '/address-book',
          '/orders',
          '/profile',
          '/wishlist',
          '/track-order',
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
