/**
 * Centralized SEO keyword library for Reveil Fragrance.
 *
 * Why one file?
 * - Single source of truth — change a keyword once, every page picks it up
 * - Easier to A/B test future keyword shifts without hunting code
 * - JSON-LD, meta keywords, hidden content, and structured copy all share these
 *
 * Strategy:
 * - HIGH_INTENT — broad commercial keywords (high search volume, high competition)
 * - LOW_COMPETITION — long-tail "gold" keywords (where new sites actually rank)
 * - BY_CATEGORY — keywords scoped per product category
 * - PRODUCT_QUALIFIERS — universal terms appended to every product page
 */

export const SITE_URL = 'https://www.reveilfragrance.in'
export const SITE_NAME = 'Reveil Fragrance'
export const BRAND_NAME = 'REVEIL'
export const LEGAL_NAME = 'Trimurty Enterprises'

// ── HIGH-INTENT COMMERCIAL KEYWORDS ─────────────────────────────────────────
export const HIGH_INTENT_KEYWORDS = [
  'buy perfumes online India',
  'best perfumes for men',
  'best perfumes for women',
  'long lasting perfumes',
  'luxury perfumes India',
  'premium fragrances India',
  'Arabian perfumes India',
  'imported perfumes online',
  'original perfumes online India',
  'eau de parfum for men',
  'eau de parfum for women',
  'affordable luxury perfumes',
  'unisex fragrances India',
  'strong projection perfumes',
  'everyday perfumes for men',
  'date night perfumes',
  'office perfumes India',
] as const

// ── LOW-COMPETITION LONG-TAIL "GOLD" KEYWORDS ───────────────────────────────
// These are where new sites realistically rank in months, not years.
export const LOW_COMPETITION_KEYWORDS = [
  // Men
  'best long lasting perfume under 999',
  'best office perfume for men India',
  'perfume for men under 1500',
  'best summer fragrance India',
  'best winter perfume for men',
  'masculine fragrances India',
  'arabic perfumes for men',
  // Women
  'floral perfumes for women',
  'sweet fragrances for women',
  'vanilla perfumes India',
  'luxury perfume under 2000',
  'everyday perfume for women',
  'long lasting perfume for girls',
  // Unisex / additional gold terms
  'best perfume gift for boyfriend',
  'best perfume gift for girlfriend',
  'long lasting attar for daily use',
  'oudh perfume India price',
  'reed diffuser for home India',
  'perfume similar to designer brands',
  'best perfume for marriage',
  'best perfume for college students',
] as const

// ── BRAND CORE KEYWORDS ─────────────────────────────────────────────────────
export const BRAND_KEYWORDS = [
  'Reveil', 'Reveil Fragrance', 'Reveil Perfumes', 'Reveil India',
  'Reveil luxury perfumes', 'reveilfragrance.in',
] as const

// ── CATEGORY-SPECIFIC KEYWORD BLOCKS ────────────────────────────────────────
export const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  PERFUMES: [
    'luxury perfume India', 'eau de parfum', 'long lasting perfume',
    'premium perfume online', 'designer perfume India', 'signature scent',
    'masculine fragrances India', 'feminine fragrances India',
    'best perfumes for men', 'best perfumes for women',
    'imported perfume online', 'original perfumes online India',
  ],
  DEODRANTS: [
    'premium deodorant India', 'long lasting deodorant', 'luxury body spray',
    'no gas deodorant', 'best deodorant for men', 'best deodorant for women',
    'daily use deodorant India',
  ],
  ATTARS: [
    'authentic attar online India', 'pure attar oil', 'alcohol free perfume',
    'arabic attar', 'oudh attar India', 'rose attar', 'sandalwood attar',
    'attar for prayer', 'long lasting attar for daily use',
  ],
  AIRFRESHNER: [
    'reed diffuser India', 'home fragrance', 'luxury air freshener',
    'long lasting room freshener', 'aroma diffuser for home',
    'best reed diffuser for living room',
  ],
  OUDH: [
    'oudh perfume India', 'agarwood perfume', 'arabian oudh',
    'long lasting oudh', 'royal oudh perfume', 'oudh perfume price India',
  ],
  MUSK: [
    'musk perfume India', 'clean musk fragrance', 'white musk perfume',
    'kasturi attar', 'sensual musk perfume',
  ],
  FLORAL: [
    'floral perfume for women', 'rose perfume India', 'jasmine perfume',
    'fresh floral fragrance', 'sweet fragrances for women',
  ],
}

// ── UNIVERSAL TAIL APPLIED TO EVERY PRODUCT PAGE ────────────────────────────
export const PRODUCT_QUALIFIERS = [
  'buy online India', 'cash on delivery', 'free shipping above 250',
  'long lasting', 'original product', 'authentic fragrance',
] as const

// ── COMPLETE KEYWORD UNION (for root layout) ────────────────────────────────
export const ALL_KEYWORDS = [
  ...BRAND_KEYWORDS,
  ...HIGH_INTENT_KEYWORDS,
  ...LOW_COMPETITION_KEYWORDS,
] as readonly string[]

// ── KEYWORD HELPER FOR DYNAMIC SEARCH PAGES ─────────────────────────────────
/**
 * Build a relevant keyword cloud for a user-entered search query. We weave the
 * search term into 6 high-intent phrases so the page ranks for "<query> india",
 * "buy <query> online", etc. without sounding spammy.
 */
export function keywordsForSearch(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...HIGH_INTENT_KEYWORDS]
  return [
    q,
    `${q} online India`,
    `buy ${q} online`,
    `best ${q} India`,
    `${q} price India`,
    `original ${q}`,
    'luxury perfumes India',
    'buy perfumes online India',
  ]
}

/** Build keyword list for a category page. */
export function keywordsForCategory(category: string | undefined): string[] {
  const key = (category || '').toUpperCase()
  const cat = CATEGORY_KEYWORDS[key] ?? []
  return [...cat, ...HIGH_INTENT_KEYWORDS.slice(0, 6)]
}

/** Build keyword list for a product page given its category. */
export function keywordsForProduct(productName: string, category?: string | null): string[] {
  const cat = CATEGORY_KEYWORDS[(category || '').toUpperCase()] ?? []
  return [
    productName,
    `${productName} price`,
    `${productName} India`,
    `buy ${productName} online`,
    `${productName} review`,
    ...cat.slice(0, 6),
    ...PRODUCT_QUALIFIERS,
  ]
}
