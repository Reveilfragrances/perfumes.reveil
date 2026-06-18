import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import HeroCarousel from '@/components/store/HeroCarousel'
import CategoryStrip from '@/components/store/CategoryStrip'
import ProductGrid from '@/components/store/ProductGrid'
import { ReveilCollectionSection, PhilosophySection, NotesSection } from '@/components/store/EditorialSections'
import { InfiniteIconCarousel } from '@/components/store/InfiniteIconCarousel'
import { NewsletterSection } from '@/components/store/NewsletterSection'
import { ReviewsSection } from '@/components/store/ReviewsSection'
import { FreeDeliveryRibbon } from '@/components/store/FreeDeliveryRibbon'
import { CouponMarquee } from '@/components/store/CouponMarquee'
import { HIGH_INTENT_KEYWORDS, LOW_COMPETITION_KEYWORDS, SITE_URL, BRAND_KEYWORDS } from '@/lib/seo/keywords'
import { faqSchema } from '@/lib/seo/schema'

export const metadata: Metadata = {
  title: "Reveil Fragrance — Buy Luxury Perfumes Online in India | Long Lasting Eau de Parfum",
  description:
    "Buy luxury perfumes online in India at Reveil Fragrance. Long-lasting eau de parfum for men & women, authentic Arabian attars, premium oudh, and luxury home fragrances. Original imported & Indian fragrances. Cash on delivery. Free shipping above ₹250.",
  keywords: [
    ...BRAND_KEYWORDS,
    ...HIGH_INTENT_KEYWORDS,
    ...LOW_COMPETITION_KEYWORDS.slice(0, 10),
  ] as unknown as string[],
  alternates: { canonical: SITE_URL },
}

// Always render fresh from the DB so admin changes — new reviews, featured
// toggles, products, carousel slides — appear immediately, never stale-cached.
export const dynamic = 'force-dynamic'


export default async function HomePage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const [
    { data: slides },
    { data: allInStockProducts },
    { data: featured },
    { data: shopCategories },
    { data: latestReviews },
  ] = await Promise.all([
    supabase
      .from('carousel_slides')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),

    supabase
      .from('products')
      .select('id, name, slug, price, images, category, rating, stock')
      .gt('stock', 0),

    supabase
      .from('products')
      .select('id, name, slug, price, images, category, rating, stock')
      .eq('is_featured', true)
      .gt('stock', 0)
      .limit(8),

    supabase
      .from('categories')
      .select('id, name, slug')
      .order('display_order', { ascending: true }),

    adminClient
      .from('reviews')
      .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer_name,
          reviewer_avatar,
          is_featured,
          profiles ( full_name, role )
      `)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(24),
  ])

  const categoryList = (shopCategories ?? []) as { id: string; name: string; slug: string }[]

  // Decide which reviews appear on the homepage showcase.
  //
  // Rule 1 (most important): if the admin ticked "Feature in Public Showcase"
  // (is_featured), the review ALWAYS shows — that toggle exists precisely to
  // curate the homepage, so we never second-guess it.
  //
  // Rule 2: for non-featured reviews, manual testimonials carry an explicit
  // reviewer_name (e.g. "Joyti S") and are stored under the admin's user_id —
  // keep those. Hide reviews authored by the admin account itself (no
  // reviewer_name) and any obvious "admin"/"test" seed data.
  const latestReviewsFiltered = (latestReviews ?? []).filter((r: any) => {
    if (r.is_featured) return true                    // curated for the showcase — always show
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    const name = (r.reviewer_name || '').toLowerCase()
    if (name.includes('admin') || name.includes('test')) return false
    if (r.reviewer_name) return true                  // manual testimonial
    if (profile?.role === 'admin') return false        // admin's own account review
    return true
  }).slice(0, 6)

  // Pick 4 products for Trending Curation, rotating daily.
  // Uses today's date (YYYY-MM-DD in IST) as a seed so the selection is
  // stable for the whole day and shuffles to a new set when the date rolls
  // over. If the admin has fewer than 4 products, we just show whatever is
  // available — no padding with placeholders.
  const seedFromDate = () => {
    // Use Intl to get the current IST date — robust to server timezone &
    // DST changes (India doesn't observe DST today, but this keeps the seed
    // correct if it ever does, or if the server runs in another zone).
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    const key = `${get('year')}-${get('month')}-${get('day')}` // "2026-05-12"
    let h = 0
    for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0
    return Math.abs(h) || 1
  }
  const mulberry32 = (a: number) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng = mulberry32(seedFromDate())
  const shuffled = [...(allInStockProducts ?? [])]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // Prioritize Featured products from the Admin Panel. 
  // If no products are marked as featured, fall back to a random daily selection.
  const trending = (featured && featured.length > 0) 
    ? featured.slice(0, 4) 
    : shuffled.slice(0, 4);

  // FAQ schema — drives rich-snippet accordions in Google search results and
  // captures "what / why / how" long-tail queries for perfume shoppers.
  const homepageFaqs = faqSchema([
    {
      q: 'Where can I buy luxury perfumes online in India?',
      a: 'Reveil Fragrance offers a curated collection of luxury perfumes, Arabian attars, premium oudh, and home fragrances online across India with free shipping above ₹250 and cash on delivery available pan-India.',
    },
    {
      q: 'Are Reveil perfumes long lasting?',
      a: 'Yes. Reveil eau de parfum formulations are high-concentration and engineered for 8–12+ hours of longevity with strong projection. Our oudh and attar collections last even longer on skin.',
    },
    {
      q: 'Which is the best perfume for men under ₹999 in India?',
      a: 'Reveil offers several long-lasting masculine fragrances under ₹999, perfect for daily office wear and date nights. Explore our affordable luxury collection in the Shop section.',
    },
    {
      q: 'Do you ship pan-India? Is cash on delivery available?',
      a: 'Yes. Reveil Fragrance delivers across every pincode in India via Shiprocket. Cash on delivery is available on orders below ₹5,000.',
    },
    {
      q: 'Are Reveil perfumes original and authentic?',
      a: 'Every Reveil product is 100% original, factory-sealed, and dispatched directly from our Brahmapur, Odisha facility. We do not sell testers or replicas.',
    },
    {
      q: 'What is the difference between attar and perfume?',
      a: 'Attars are concentrated, alcohol-free fragrance oils traditionally distilled from natural materials. Perfumes (eau de parfum) are alcohol-based and project further on skin. Reveil offers both for different occasions.',
    },
    {
      q: 'Which perfume is best for summer in India?',
      a: 'For Indian summers, choose fresh citrus, aquatic, or light floral notes from our floral and musk collections. They feel cooling and project without becoming overpowering in heat.',
    },
  ])

  // Hero carousel is now driven entirely by admin-managed slides from the DB.
  const allSlides = slides ?? []

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageFaqs) }}
      />
      <main style={{ background: '#f8f7f2', color: '#1a1a1a', overflowX: 'hidden' }}>
        {/* ── HIDDEN SEO CONTENT (screen-reader only, indexed by Google) ──
            God-level SEO: rich keyword-targeted copy spanning every major
            commercial intent for the perfume vertical in India. Not visible
            on screen but fully crawlable. */}
        <div className="sr-only">
          <h1>Buy Luxury Perfumes Online India — Reveil Fragrance | Long Lasting Eau de Parfum for Men &amp; Women</h1>
          <h2>Best Perfumes for Men &amp; Women, Arabian Attars, Premium Oudh, and Luxury Home Fragrances in India</h2>
          <p>
            Welcome to Reveil Fragrance — India&apos;s premier destination for original luxury
            perfumes, long lasting eau de parfum for men and women, authentic Arabian attars,
            premium oudh, and luxury reed diffusers. Every fragrance is crafted for maximum
            longevity, strong projection, and signature character. Cash on delivery available.
            Free shipping above ₹250. Pan-India delivery via Shiprocket.
          </p>

          <h2>Shop by Intent</h2>
          <ul>
            <li>Best perfumes for men in India — masculine fragrances, office perfumes, date night perfumes</li>
            <li>Best perfumes for women in India — floral perfumes, sweet fragrances, vanilla perfumes</li>
            <li>Long lasting perfumes — 8 to 12+ hour projection eau de parfum</li>
            <li>Luxury perfumes India — affordable luxury perfumes under ₹2000</li>
            <li>Arabian perfumes India — imported attars, oudh, agarwood, royal scents</li>
            <li>Unisex fragrances India — modern shareable signatures</li>
            <li>Eau de parfum for men &amp; women — strong projection perfumes</li>
            <li>Everyday perfumes for men — best office perfume for men India</li>
            <li>Date night perfumes — sensual musk, vanilla, and oudh scents</li>
            <li>Perfume gifts — best perfume gift for boyfriend, girlfriend, and weddings</li>
          </ul>

          <h2>Low Competition Gold Categories</h2>
          <ul>
            <li>Best long lasting perfume under ₹999 in India</li>
            <li>Perfume for men under ₹1500 — affordable masculine fragrance</li>
            <li>Best summer fragrance India — fresh citrus and aquatic perfumes</li>
            <li>Best winter perfume for men — warm oudh, amber, and spice</li>
            <li>Arabic perfumes for men — authentic Arabian attar India</li>
            <li>Floral perfumes for women — rose, jasmine, freesia, peony notes</li>
            <li>Sweet fragrances for women — vanilla perfumes India, gourmand scents</li>
            <li>Luxury perfume under ₹2000 — affordable signature eau de parfum</li>
            <li>Everyday perfume for women — daily wear, college, office</li>
            <li>Long lasting perfume for girls — projection and sillage focused</li>
            <li>Oudh perfume India price — royal oudh, agarwood fragrance</li>
            <li>Reed diffuser for home India — luxury home fragrance, room freshener</li>
          </ul>

          <h3>Why Choose Reveil Fragrance?</h3>
          <p>
            Reveil Fragrance is a luxury perfumery brand based in Brahmapur, Odisha — proudly
            shipping across India. Our laboratory crafts long-lasting signature scents
            comparable to designer brands at fraction of the price. We source the finest
            aromatic compounds, oudh, attars, and floral absolutes for original perfumes you
            can trust. Every bottle is factory-sealed, authentic, and dispatched directly to
            your door with cash on delivery and free shipping options.
          </p>

          <h3>Reveil Perfume Categories</h3>
          <ul>
            <li>Perfumes — luxury eau de parfum for men and women</li>
            <li>Attars — authentic alcohol-free attar oils, oudh attar, rose attar</li>
            <li>Deodorants — premium long-lasting body sprays</li>
            <li>Air Fresheners — luxury reed diffusers for home and office</li>
            <li>Oudh Collection — agarwood, royal oudh, Arabian oudh perfumes</li>
            <li>Musk &amp; Floral — clean musk, jasmine, rose, sandalwood signatures</li>
          </ul>
        </div>

        {/* Hero section */}
        <HeroCarousel slides={allSlides} />

        {/* Active coupon codes — thin scrolling banner (renders nothing if none) */}
        <CouponMarquee />

        {/* Shop by Category — dynamic, driven by the admin `categories` table */}
        <CategoryStrip categories={categoryList} />

        {/* Free Delivery Ribbon */}
        <FreeDeliveryRibbon />

        {/* 1. Trending Curation */}
        <ProductGrid items={trending ?? []} />

        {/* 2. Collections */}
        <NotesSection />

        {/* 3. Reviews */}
        <ReviewsSection reviews={latestReviewsFiltered} />

        {/* 4. Reveil Collection Big Image */}
        <ReveilCollectionSection />

        {/* Brand Theme / Value Carousel */}
        <InfiniteIconCarousel />

        {/* 5. Our Story */}
        <PhilosophySection />

        {/* 6. Join Reveil */}
        <NewsletterSection />

      </main>
    </>
  )
}