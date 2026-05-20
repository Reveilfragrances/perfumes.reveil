/**
 * JSON-LD structured data builders for Reveil Fragrance.
 *
 * Google reads these to power rich results: site links, breadcrumbs, ratings,
 * product cards in search, FAQ accordions, and knowledge-panel basics.
 *
 * Keep one builder per schema type so pages compose only what they need.
 */

import { SITE_URL, SITE_NAME, BRAND_NAME, LEGAL_NAME } from './keywords'

// ── ORGANIZATION (sitewide) ─────────────────────────────────────────────────
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    legalName: LEGAL_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: `${BRAND_NAME} crafts long-lasting luxury perfumes, authentic attars, premium deodorants, and home fragrances in India.`,
    foundingDate: '2026',
    sameAs: [
      'https://www.instagram.com/reveilfragrance/',
      'https://www.facebook.com/reveilfragrance/',
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Brahmapur',
      addressLocality: 'Brahmapur',
      addressRegion: 'Odisha',
      postalCode: '760002',
      addressCountry: 'IN',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'reveilfragrances@gmail.com',
        areaServed: 'IN',
        availableLanguage: ['en', 'hi'],
      },
    ],
  }
}

// ── WEBSITE (sitewide, with search action) ──────────────────────────────────
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en-IN',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

// ── BREADCRUMB ──────────────────────────────────────────────────────────────
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

// ── FAQ PAGE (homepage rich snippet) ────────────────────────────────────────
export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  }
}

// ── COLLECTION PAGE (category landing) ──────────────────────────────────────
export function collectionPageSchema(opts: {
  name: string
  description: string
  url: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
}

// ── LOCAL BUSINESS (helps map / local-pack rankings in Odisha) ──────────────
export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${SITE_URL}/#localbusiness`,
    name: BRAND_NAME,
    image: `${SITE_URL}/logo.png`,
    telephone: '+91-8114325023',
    priceRange: '₹₹',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Brahmapur',
      addressLocality: 'Brahmapur',
      addressRegion: 'Odisha',
      postalCode: '760002',
      addressCountry: 'IN',
    },
    url: SITE_URL,
  }
}

// ── SITE NAVIGATION (forces sitelinks) ──────────────────────────────────────
export function siteNavigationElementSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'itemListElement': [
      {
        '@type': 'SiteNavigationElement',
        'position': 1,
        'name': 'Shop All Perfumes',
        'url': `${SITE_URL}/products`
      },
      {
        '@type': 'SiteNavigationElement',
        'position': 2,
        'name': 'Track Order',
        'url': `${SITE_URL}/track-order`
      },
      {
        '@type': 'SiteNavigationElement',
        'position': 3,
        'name': 'My Orders',
        'url': `${SITE_URL}/orders`
      },
      {
        '@type': 'SiteNavigationElement',
        'position': 4,
        'name': 'Contact Us',
        'url': `${SITE_URL}/contact`
      },
      {
        '@type': 'SiteNavigationElement',
        'position': 5,
        'name': 'About Reveil',
        'url': `${SITE_URL}/about`
      }
    ]
  }
}
