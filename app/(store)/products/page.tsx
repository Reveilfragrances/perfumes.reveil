import type { Metadata } from 'next'
import { ProductListContent } from './ProductListContent'
import { Suspense } from 'react'
import { PremiumLoader } from '@/components/store/PremiumLoader'
import {
  SITE_URL,
  HIGH_INTENT_KEYWORDS,
  LOW_COMPETITION_KEYWORDS,
  keywordsForCategory,
  keywordsForSearch,
} from '@/lib/seo/keywords'
import { collectionPageSchema, breadcrumbSchema } from '@/lib/seo/schema'

const CATEGORY_META: Record<string, { title: string; description: string; h1: string; intro: string }> = {
  PERFUMES: {
    title: 'Buy Luxury Perfumes Online India — Long Lasting Eau de Parfum | Reveil',
    description:
      'Shop luxury perfumes online in India. Long lasting eau de parfum for men and women with strong projection. Original imported & Indian fragrances. Cash on delivery. Free shipping above ₹250.',
    h1: 'Luxury Perfumes Online India — Long Lasting Eau de Parfum',
    intro:
      'Discover Reveil&apos;s curated collection of long-lasting luxury perfumes for men and women. High-concentration eau de parfum with strong sillage, designed for office, date nights, and every memorable occasion. Original, authentic, pan-India delivery.',
  },
  DEODRANTS: {
    title: 'Premium Deodorants & Long Lasting Body Sprays India | Reveil',
    description:
      'Buy premium deodorants and luxury body sprays online in India. Long-lasting, daily-use fragrances for men and women. Authentic, cash on delivery available.',
    h1: 'Premium Deodorants &amp; Long Lasting Body Sprays India',
    intro:
      'All-day freshness from Reveil&apos;s premium deodorant range. Inspired by our signature perfume lines and engineered for Indian climate.',
  },
  ATTARS: {
    title: 'Authentic Attars Online India — Pure Perfume Oils, Oudh Attar | Reveil',
    description:
      'Buy authentic attars online in India. Pure alcohol-free perfume oils — oudh attar, rose attar, sandalwood attar, jasmine, and Arabian attar collections. Original, long lasting attar for daily use.',
    h1: 'Authentic Attars Online India — Pure Perfume Oils',
    intro:
      'Traditional Indian and Arabian attars, distilled into highly concentrated alcohol-free oils. Perfect for daily wear, prayer, and special occasions. Long lasting attar for daily use.',
  },
  AIRFRESHNER: {
    title: 'Luxury Reed Diffusers & Home Fragrances India | Reveil',
    description:
      'Transform your home with luxury reed diffusers and premium air fresheners from Reveil. Long-lasting signature scents for living room, bedroom, and office.',
    h1: 'Luxury Reed Diffusers &amp; Home Fragrances India',
    intro:
      'Signature home fragrances designed to scent your space the way couture perfumes scent skin. Premium reed diffusers with refined long-lasting projection.',
  },
  OUDH: {
    title: 'Premium Oudh Perfumes India — Agarwood & Royal Oudh | Reveil',
    description:
      'Buy premium oudh perfumes online in India. Authentic agarwood, royal oudh, and Arabian oudh fragrances. Long lasting, original imported oudh perfume India price.',
    h1: 'Premium Oudh Perfumes India — Agarwood &amp; Arabian Oudh',
    intro:
      'Enter the deep, resinous world of Reveil Oudh. Intense, smoky, royal — handcrafted oudh perfumes for true connoisseurs of agarwood fragrance.',
  },
  MUSK: {
    title: 'Signature Musk Perfumes India — Clean &amp; Sensual Scents | Reveil',
    description:
      'Buy signature musk perfumes online in India. Clean white musk, sensual kasturi, and modern shareable scents for men and women.',
    h1: 'Signature Musk Perfumes India — Clean &amp; Sensual',
    intro:
      'Elegant musk fragrances from the Reveil studio. Soft, skin-like sophistication or rich sensual musk — for the wearer who prefers intimacy over loudness.',
  },
  FLORAL: {
    title: 'Floral Perfumes for Women India — Rose, Jasmine, Sweet Fragrances | Reveil',
    description:
      'Buy floral perfumes for women online in India. Rose, jasmine, peony, freesia, and sweet vanilla fragrances. Long lasting feminine perfumes, perfect everyday perfume for women.',
    h1: 'Floral Perfumes for Women India — Rose, Jasmine &amp; Sweet Fragrances',
    intro:
      'Reveil&apos;s floral collection captures the romance of fresh bouquets and sweet gourmand accords. Long lasting perfume for girls and women — everyday, evening, and special occasions.',
  },
}

const DEFAULT_META = {
  title: 'Shop All Fragrances Online India — Luxury Perfumes &amp; Attars | Reveil Fragrance',
  description:
    'Shop original luxury perfumes, authentic attars, premium oudh, and home fragrances online in India. Best perfumes for men and women. Cash on delivery, free shipping above ₹250, pan-India delivery.',
  h1: 'Shop All Fragrances Online India — Luxury Perfumes &amp; Attars',
  intro:
    'Browse the complete Reveil Fragrance archive. Long-lasting eau de parfum for men and women, authentic Arabian attars, premium oudh, and luxury home diffusers — all original, all delivered across India.',
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string }>
}): Promise<Metadata> {
  const { category, search } = await searchParams
  const catKey = category?.toUpperCase()
  const meta = catKey ? CATEGORY_META[catKey] : null

  // Dynamic SEO — if the user searched for "oudh" or "rose attar", we generate
  // a title/description/keywords pack centered on that query so the page can
  // rank for "<query> India", "buy <query> online", etc.
  if (search) {
    const cleanSearch = search.trim().slice(0, 60)
    return {
      title: `${cleanSearch} — Buy Online India | Reveil Fragrance`,
      description: `Shop ${cleanSearch} and similar luxury perfumes online in India at Reveil Fragrance. Long lasting, original, free shipping above ₹250, cash on delivery available.`,
      keywords: keywordsForSearch(cleanSearch),
      alternates: { canonical: `${SITE_URL}/products?search=${encodeURIComponent(cleanSearch)}` },
      robots: { index: false, follow: true }, // don't index every search permutation
    }
  }

  const title = meta?.title ?? DEFAULT_META.title
  const description = meta?.description ?? DEFAULT_META.description
  const url = category ? `${SITE_URL}/products?category=${category}` : `${SITE_URL}/products`

  return {
    title,
    description,
    keywords: keywordsForCategory(category),
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: url },
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string }>
}) {
  const { category, search } = await searchParams
  const catKey = category?.toUpperCase()
  const meta = (catKey && CATEGORY_META[catKey]) ? CATEGORY_META[catKey] : DEFAULT_META
  const url = category ? `${SITE_URL}/products?category=${category}` : `${SITE_URL}/products`

  // Build CollectionPage + BreadcrumbList JSON-LD for category landings.
  const schemas = [
    collectionPageSchema({
      name: meta.title.replace(/&amp;/g, '&'),
      description: meta.description,
      url,
    }),
    breadcrumbSchema([
      { name: 'Home', url: SITE_URL },
      { name: 'Shop', url: `${SITE_URL}/products` },
      ...(category
        ? [{ name: category.replace(/_/g, ' '), url }]
        : []),
    ]),
  ]

  return (
    <Suspense fallback={<PremiumLoader iconName="sparkles" text="Loading Fragrances" />}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
      />

      {/* ── HIDDEN SEO HEADINGS &amp; CONTENT (sr-only, indexed by Google) ── */}
      <div className="sr-only">
        <h1 dangerouslySetInnerHTML={{ __html: meta.h1 }} />
        <h2>
          {search
            ? `Search results for "${search}" — buy ${search} online India`
            : 'Best Long Lasting Perfumes, Premium Oudh, Arabian Attars &amp; Luxury Home Fragrances'}
        </h2>
        <p dangerouslySetInnerHTML={{ __html: meta.intro }} />

        <h3>Popular Searches in This Collection</h3>
        <ul>
          {HIGH_INTENT_KEYWORDS.slice(0, 10).map((kw) => (
            <li key={kw}>{kw}</li>
          ))}
        </ul>

        <h3>Trending Niche Categories</h3>
        <ul>
          {LOW_COMPETITION_KEYWORDS.slice(0, 12).map((kw) => (
            <li key={kw}>{kw}</li>
          ))}
        </ul>

        <h3>Why Shop at Reveil Fragrance</h3>
        <ul>
          <li>Original products — every fragrance is factory sealed and authentic</li>
          <li>Long lasting projection — 8 to 12+ hours of sillage</li>
          <li>Pan-India delivery via Shiprocket — cash on delivery available</li>
          <li>Free shipping on orders above ₹250</li>
          <li>Affordable luxury — premium fragrances at honest prices</li>
        </ul>
      </div>

      <ProductListContent />
    </Suspense>
  )
}
