# MASTER PROMPT — REVEIL FRAGRANCE: CRAWLABILITY, SITEMAP & MERCHANT CENTER FIXES
## Version 3 — Addendum to Master Prompt V2

---

## CONFIRMED TECH STACK
- **Framework**: Next.js App Router (`app/` directory)
- **Styling**: Tailwind CSS only
- **Database**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Email**: Resend (already integrated)
- **Google Merchant Center ID**: `5810608440`

## DEVELOPMENT APPROACH — MANDATORY
Use sequential thinking for every task:
1. **READ** every file you will touch before writing a single line
2. **CHECK** Supabase table schema before writing any query
3. **COMPLETE** each file fully before moving to the next
4. **NEVER** delete existing working code — only extend
5. All secrets in `.env.local` — never hardcode

---

## PROBLEM STATEMENT (Read this fully before doing anything)

Google crawlers and Google Merchant Center can only see the **4-5 products shown on the
homepage**. Every product in the `/products` shop page is completely invisible to Google,
crawlers, and the Merchant Center. The root causes are:

1. **No dynamic sitemap** — the static `public/sitemap.xml` has zero product URLs
2. **No server-side rendering of product data** — the shop page fetches products
   client-side (in `useEffect`/`useState`), so crawlers see an empty page
3. **No JSON-LD structured data** on product pages — Google can't parse product info
4. **Products not pushed to Google Merchant Center** — only homepage-visible products
   were manually discovered
5. **Missing required Merchant Center fields**: `unit_pricing_measure`, shipping costs,
   `aggregateRating`, `review`
6. **Restricted adult content flag** — product descriptions contain words Google flags
   as adult content (e.g. "musk", "sensual", "seductive") — these need to be reworded

Fix all 6 causes. Do not fix one without the others — they are all required together.

---

## SECTION A — SUPABASE SCHEMA MIGRATIONS
### Run first, before touching any code

Open Supabase Dashboard → SQL Editor → run this entire block:

```sql
-- ─── Products table: add missing columns if not present ───────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- unit_pricing_measure: required by Google Merchant Center for India
-- Store the unit the product is measured in, e.g. 'ml', 'g', 'fl oz'
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'ml';
-- unit_pricing_base_measure: the base unit for comparison, e.g. 100ml
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_pricing_base_measure TEXT DEFAULT '100ml';

-- shipping_weight in kg — required for shipping cost calculation
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_weight NUMERIC DEFAULT 0.5;

-- Google product category ID (numeric string)
-- 2915 = Health & Beauty > Fragrances
ALTER TABLE products ADD COLUMN IF NOT EXISTS google_product_category TEXT DEFAULT '2915';

-- ─── Auto-update updated_at trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ─── Backfill slugs for all existing products that have no slug ───────────────
-- This generates a URL-safe slug from the product name

UPDATE products
SET slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL OR slug = '';

-- ─── Backfill SKUs (max 40 chars, auto-generate if missing) ───────────────────

UPDATE products
SET sku = 'REVEIL-' || upper(substring(id::text, 1, 8))
WHERE sku IS NULL OR sku = '';

UPDATE products
SET sku = substring(sku, 1, 40)
WHERE length(sku) > 40;

-- ─── Categories table: add slug if missing ────────────────────────────────────

ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE categories
SET slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL OR slug = '';

-- ─── Reviews table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID,
  author_name TEXT NOT NULL DEFAULT 'Verified Buyer',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved);

-- ─── Function to auto-update product rating aggregates ────────────────────────

CREATE OR REPLACE FUNCTION sync_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET
    average_rating = (
      SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
      FROM reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND is_approved = true
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND is_approved = true
    )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS sync_rating_on_review ON reviews;
CREATE TRIGGER sync_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE PROCEDURE sync_product_rating();

-- ─── Coupon usage increment RPC ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_coupon_usage(p_coupon_id UUID)
RETURNS void AS $$
  UPDATE coupons SET usage_count = usage_count + 1 WHERE id = p_coupon_id;
$$ LANGUAGE sql;

-- ─── Enable Row Level Security for public product reads ───────────────────────

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active products" ON products;
CREATE POLICY "Public read active products"
  ON products FOR SELECT
  USING (is_active = true);

-- Allow service role to do everything (bypasses RLS automatically)
-- No additional policy needed for service role key
```

---

## SECTION B — FIX SHOP PAGE: SERVER-SIDE RENDERING (CRITICAL FOR CRAWLERS)

### Why this matters
The current shop page at `/products` loads products via `useEffect` or `useState` with a
client-side `fetch`. Google's crawler executes JavaScript but does NOT wait for async
data fetches — it sees an empty product grid. This is why only homepage products
(which are likely rendered server-side or statically) are visible to Google.

### Find the shop page file
It will be at one of these paths — check which one exists:
- `app/products/page.tsx`
- `app/products/page.jsx`

### Read the file first. Then apply this change:

Remove the `'use client'` directive from this file if it is the only reason for it
being a client component. Convert it to a **React Server Component** (RSC) that
fetches products directly from Supabase on the server.

The pattern to follow:

```tsx
// app/products/page.tsx
// THIS IS A SERVER COMPONENT — do NOT add 'use client' at the top

import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';

// Import your existing product card component — do not rebuild it
// Find its actual import path in the existing file before writing this
import ProductCard from '@/components/ProductCard'; // adjust to actual path
import ProductFilters from '@/components/ProductFilters'; // adjust to actual path — may be client component

export const metadata: Metadata = {
  title: 'Shop All Fragrances | Reveil Fragrance',
  description:
    'Explore Reveil Fragrance\'s full collection of perfumes, attars, deodorants, oudh, musk, floral scents, and car fresheners. Free shipping across India.',
  keywords: 'perfume, attar, deodorant, oudh, musk, air freshener, car freshener, India',
};

// Use service role key — this runs on the SERVER only, never exposed to browser
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
  searchParams: { category?: string; sort?: string; q?: string };
}

export default async function ProductsPage({ searchParams }: PageProps) {
  // Build query — fetch ALL active products with all fields crawlers need
  let query = supabase
    .from('products')
    .select(
      'id, name, slug, price, images, category, sku, description, ' +
      'meta_title, meta_description, average_rating, review_count, stock, updated_at'
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Apply category filter if present in URL
  if (searchParams.category) {
    query = query.ilike('category', searchParams.category);
  }

  // Apply search filter if present
  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`);
  }

  const { data: products, error } = await query;

  if (error) {
    console.error('Products fetch error:', error.message);
  }

  // Fetch all active categories for filter sidebar
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name');

  return (
    <main>
      {/* Keep all existing JSX structure — only replace the data source */}
      {/* Pass server-fetched products as props to any client sub-components */}
      
      {/* Category filter — if this is a client component, pass categories as props */}
      {/* <ProductFilters categories={categories || []} /> */}

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {(products || []).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* If no products found */}
      {(!products || products.length === 0) && (
        <div className="py-20 text-center text-gray-500">
          No products found.
        </div>
      )}
    </main>
  );
}
```

**IMPORTANT NOTE TO CODER**: Do not rebuild the entire page. Read the existing file,
keep all existing layout, classnames, and UI structure. Only change:
1. Remove `useEffect` and `useState` for products data
2. Make the component `async` and fetch data directly
3. Pass data as props down to any child client components that need `'use client'`

---

## SECTION C — FULLY DYNAMIC SITEMAP WITH ALL PRODUCTS

### Delete the static file
Delete `public/sitemap.xml` — this file must not exist.

### Create the dynamic sitemap route

Create file: `app/sitemap.xml/route.ts`

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function xml(str: string) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const dynamic = 'force-dynamic'; // never cache — always live data
export const revalidate = 0;

export async function GET() {
  const base = 'https://www.reveilfragrance.in';
  const now = new Date().toISOString();

  // Fetch every active product
  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at, meta_title, images, name')
    .eq('is_active', true)
    .not('slug', 'is', null)
    .order('updated_at', { ascending: false });

  // Fetch every active category
  const { data: categories } = await supabase
    .from('categories')
    .select('slug, name, updated_at')
    .eq('is_active', true)
    .not('slug', 'is', null);

  // Static pages that should always be indexed
  const staticPages = [
    { loc: '/',             changefreq: 'daily',   priority: '1.0',  lastmod: now },
    { loc: '/products',     changefreq: 'daily',   priority: '0.95', lastmod: now },
    { loc: '/about',        changefreq: 'monthly', priority: '0.6',  lastmod: now },
    { loc: '/contact',      changefreq: 'monthly', priority: '0.5',  lastmod: now },
    { loc: '/shipping',     changefreq: 'monthly', priority: '0.4',  lastmod: now },
    { loc: '/refund',       changefreq: 'monthly', priority: '0.4',  lastmod: now },
    { loc: '/terms',        changefreq: 'yearly',  priority: '0.3',  lastmod: now },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${staticPages.map(p => `  <url>
    <loc>${base}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}

${(categories || []).map(cat => `  <url>
    <loc>${base}/products?category=${encodeURIComponent(cat.slug)}</loc>
    <lastmod>${cat.updated_at ? new Date(cat.updated_at).toISOString() : now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`).join('\n')}

${(products || []).map(p => {
    const imgTag = p.images?.[0]
      ? `\n    <image:image>\n      <image:loc>${xml(p.images[0])}</image:loc>\n      <image:title>${xml(p.meta_title || p.name)}</image:title>\n    </image:image>`
      : '';
    return `  <url>
    <loc>${base}/products/${p.slug}</loc>
    <lastmod>${p.updated_at ? new Date(p.updated_at).toISOString() : now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>${imgTag}
  </url>`;
  }).join('\n')}

</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Do not cache — always serve fresh data
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
```

### Also add robots.txt to guide crawlers

Create file: `app/robots.txt/route.ts`

```ts
export async function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /profile
Disallow: /orders
Disallow: /wishlist
Disallow: /cart
Disallow: /checkout

Sitemap: https://www.reveilfragrance.in/sitemap.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

---

## SECTION D — PRODUCT PAGE: SERVER-SIDE RENDERING + COMPLETE JSON-LD SCHEMA

### Find the product detail page
It will be at: `app/products/[slug]/page.tsx` (or `.jsx`)

Read the file first. Then make these changes:

### Step 1 — Ensure the page is a Server Component fetching from Supabase directly

```tsx
// app/products/[slug]/page.tsx
// SERVER COMPONENT — no 'use client'

import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductSchema from '@/components/ProductSchema'; // created below

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Props {
  params: { slug: string };
}

// generateStaticParams: pre-generate all product pages at build time
// This makes ALL product pages crawlable even without JavaScript execution
export async function generateStaticParams() {
  const { data } = await supabase
    .from('products')
    .select('slug')
    .eq('is_active', true)
    .not('slug', 'is', null);

  return (data || []).map((p) => ({ slug: p.slug }));
}

// Tell Next.js to revalidate product pages every hour
// (so new products/edits appear without full redeploy)
export const revalidate = 3600;

// generateMetadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: product } = await supabase
    .from('products')
    .select('name, meta_title, meta_description, meta_keywords, images, slug')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single();

  if (!product) return { title: 'Product Not Found | Reveil Fragrance' };

  return {
    title: `${product.meta_title || product.name} | Reveil Fragrance`,
    description: product.meta_description || '',
    keywords: product.meta_keywords || '',
    openGraph: {
      title: product.meta_title || product.name,
      description: product.meta_description || '',
      images: product.images?.[0] ? [{ url: product.images[0] }] : [],
      url: `https://www.reveilfragrance.in/products/${product.slug}`,
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: Props) {
  // Fetch product
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single();

  if (!product) notFound();

  // Fetch approved reviews for this product
  const { data: reviews } = await supabase
    .from('reviews')
    .select('author_name, rating, comment, created_at')
    .eq('product_id', product.id)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(10);

  const productWithReviews = { ...product, reviews: reviews || [] };

  return (
    <>
      {/* JSON-LD schema injected in <head> — crawlers read this */}
      <ProductSchema product={productWithReviews} />

      {/* Keep all existing product page JSX below this line — do not change it */}
      {/* Only add the ProductSchema component above the existing content */}
    </>
  );
}
```

### Step 2 — Create the complete ProductSchema component

Create file: `components/ProductSchema.tsx`

This component outputs a `<script type="application/ld+json">` tag that fixes ALL
the Google Search Console and Merchant Center structured data errors:
- Missing `aggregateRating`
- Missing `review`
- Missing `hasMerchantReturnPolicy`
- Missing `unit_pricing_measure`
- Missing shipping costs

```tsx
interface Review {
  author_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  meta_description?: string;
  sku?: string;
  price: number;
  stock: number;
  images?: string[];
  average_rating?: number;
  review_count?: number;
  reviews?: Review[];
  unit?: string;               // e.g. 'ml', 'g'
  unit_pricing_base_measure?: string; // e.g. '100ml'
  shipping_weight?: number;    // in kg
}

export default function ProductSchema({ product }: { product: Product }) {
  const baseUrl = 'https://www.reveilfragrance.in';

  // SKU: max 40 chars, auto-generate if missing — fixes "Invalid string length in sku"
  const sku = product.sku
    ? String(product.sku).substring(0, 40)
    : `REVEIL-${product.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.meta_description || product.description || product.name,
    sku,
    mpn: sku,
    brand: { '@type': 'Brand', name: 'Reveil Fragrance' },
    image: product.images || [],
    url: `${baseUrl}/products/${product.slug}`,
  };

  // ── aggregateRating ── fixes "Missing aggregateRating" warning
  // Only include when the product has at least 1 approved review
  if (product.review_count && product.review_count > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.average_rating || 4.0).toFixed(1),
      reviewCount: product.review_count,
      bestRating: '5',
      worstRating: '1',
    };
  }

  // ── review ── fixes "Missing review" warning
  // Only include when approved reviews exist
  if (product.reviews && product.reviews.length > 0) {
    schema.review = product.reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: String(r.rating),
        bestRating: '5',
        worstRating: '1',
      },
      author: { '@type': 'Person', name: r.author_name || 'Verified Buyer' },
      reviewBody: r.comment || '',
      datePublished: new Date(r.created_at).toISOString().split('T')[0],
    }));
  }

  schema.offers = {
    '@type': 'Offer',
    url: `${baseUrl}/products/${product.slug}`,
    priceCurrency: 'INR',
    price: product.price.toFixed(2),
    priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    availability:
      product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: {
      '@type': 'Organization',
      name: 'Reveil Fragrance',
      url: baseUrl,
    },

    // ── unit_pricing_measure ── fixes "Missing unit pricing measure" error
    // Required by Google for liquid/weighted products in India
    ...(product.unit
      ? {
          unitPricingMeasure: {
            '@type': 'QuantitativeValue',
            value: parseFloat(product.unit_pricing_base_measure || '100') || 100,
            unitCode: product.unit === 'ml' ? 'MLT' : product.unit === 'g' ? 'GRM' : 'MLT',
          },
          unitPricingBaseMeasure: {
            '@type': 'QuantitativeValue',
            value: 100,
            unitCode: product.unit === 'ml' ? 'MLT' : product.unit === 'g' ? 'GRM' : 'MLT',
          },
        }
      : {}),

    // ── shippingDetails ── fixes "Missing shipping costs" in Merchant Center
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: '0',      // Free shipping across India
        currency: 'INR',
      },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'IN',
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 0,
          maxValue: 1,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: 3,
          maxValue: 7,
          unitCode: 'DAY',
        },
      },
    },

    // ── hasMerchantReturnPolicy ── fixes "Missing hasMerchantReturnPolicy" warning
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'IN',
      returnPolicyCategory:
        'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/FreeReturn',
      refundType: 'https://schema.org/FullRefund',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

---

## SECTION E — GOOGLE MERCHANT CENTER AUTO-SYNC

### Updated Merchant Center ID: `5810608440`

Create file: `lib/google-sync.ts`

Install googleapis first:
```bash
npm install googleapis
```

```ts
import { google } from 'googleapis';

const MERCHANT_ID = '5810608440'; // confirmed Merchant Center ID

function getAuth(scopes: string[]) {
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
    scopes,
  });
}

// ── Notify Google Search Console Indexing API ──────────────────────────────────

export async function notifyGoogleIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
) {
  try {
    const auth = getAuth(['https://www.googleapis.com/auth/indexing']);
    const client = await auth.getClient();
    const indexing = google.indexing({ version: 'v3', auth: client as never });
    await indexing.urlNotifications.publish({ requestBody: { url, type } });
    console.log(`[Indexing API] ${type}: ${url}`);
  } catch (e: unknown) {
    console.error('[Indexing API error]', (e as Error).message);
  }
}

// ── Build Merchant Center product payload ──────────────────────────────────────

function buildMerchantProduct(p: {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sku?: string;
  price: number;
  stock: number;
  images?: string[];
  category?: string;
  unit?: string;
  unit_pricing_base_measure?: string;
  shipping_weight?: number;
}) {
  const sku = p.sku
    ? String(p.sku).substring(0, 40)
    : `REVEIL-${p.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

  // unit_pricing_measure — required for India (liquid products)
  // Format: '{value}{unit}' e.g. '50ml', '100ml', '6ml'
  const unitCode = p.unit || 'ml';
  const baseMeasure = p.unit_pricing_base_measure || '100ml';

  return {
    offerId: sku,
    title: p.name,
    description: (p.description || p.name).substring(0, 5000),
    link: `https://www.reveilfragrance.in/products/${p.slug}`,
    imageLink: p.images?.[0] || '',
    additionalImageLinks: (p.images || []).slice(1, 10),
    contentLanguage: 'en',
    targetCountry: 'IN',
    channel: 'online',
    availability: p.stock > 0 ? 'in stock' : 'out of stock',
    condition: 'new',
    price: { value: p.price.toFixed(2), currency: 'INR' },
    brand: 'Reveil Fragrance',
    mpn: sku,
    googleProductCategory: '2915', // Health & Beauty > Fragrances
    
    // unit_pricing_measure — fixes "Missing unit pricing measure" in Merchant Center
    unitPricingMeasure: { value: parseFloat(baseMeasure) || 100, unit: unitCode },
    unitPricingBaseMeasure: { value: 100, unit: unitCode },

    // shipping — fixes "Missing shipping costs" in Merchant Center
    shipping: [
      {
        country: 'IN',
        service: 'Standard Free Shipping',
        price: { value: '0.00', currency: 'INR' },
      },
    ],

    // shipping_weight
    shippingWeight: {
      value: p.shipping_weight || 0.5,
      unit: 'kg',
    },

    // return policy
    // Note: return policy must also be configured in Merchant Center dashboard
    // under Products & Store → Shipping and Returns → Return policies
  };
}

// ── Push product to Merchant Center (create or update) ────────────────────────

export async function upsertMerchantProduct(
  p: Parameters<typeof buildMerchantProduct>[0]
) {
  try {
    const auth = getAuth(['https://www.googleapis.com/auth/content']);
    const client = await auth.getClient();
    const content = google.content({ version: 'v2.1', auth: client as never });
    const payload = buildMerchantProduct(p);
    await content.products.insert({ merchantId: MERCHANT_ID, requestBody: payload });
    console.log(`[Merchant Center] Upserted: ${p.slug}`);
  } catch (e: unknown) {
    console.error('[Merchant Center upsert error]', (e as Error).message);
  }
}

// ── Remove product from Merchant Center ───────────────────────────────────────

export async function deleteMerchantProduct(p: {
  id: string;
  sku?: string;
  slug: string;
}) {
  try {
    const sku = p.sku
      ? String(p.sku).substring(0, 40)
      : `REVEIL-${p.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;
    const auth = getAuth(['https://www.googleapis.com/auth/content']);
    const client = await auth.getClient();
    const content = google.content({ version: 'v2.1', auth: client as never });
    await content.products.delete({
      merchantId: MERCHANT_ID,
      productId: `online:en:IN:${sku}`,
    });
    console.log(`[Merchant Center] Deleted: ${p.slug}`);
  } catch (e: unknown) {
    console.error('[Merchant Center delete error]', (e as Error).message);
  }
}

// ── Bulk sync ALL products — run once to push existing inventory ───────────────

export async function bulkSyncAllProducts() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, description, sku, price, stock, images, category, unit, unit_pricing_base_measure, shipping_weight')
    .eq('is_active', true);

  if (!products) return;

  console.log(`[Merchant Center] Starting bulk sync of ${products.length} products...`);

  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < products.length; i += 5) {
    const batch = products.slice(i, i + 5);
    await Promise.all(batch.map(upsertMerchantProduct));
    if (i + 5 < products.length) {
      await new Promise((r) => setTimeout(r, 1000)); // 1s delay between batches
    }
  }

  console.log('[Merchant Center] Bulk sync complete.');
}
```

### Create a one-time bulk sync API route (admin only)

Create file: `app/api/admin/sync-merchant/route.ts`

```ts
import { bulkSyncAllProducts } from '@/lib/google-sync';
import { NextResponse } from 'next/server';

export async function POST() {
  // Add your admin auth check here — only admins should be able to call this
  await bulkSyncAllProducts();
  return NextResponse.json({ success: true, message: 'Bulk sync triggered' });
}
```

After deploying, call this once from your admin panel or Postman:
```
POST https://www.reveilfragrance.in/api/admin/sync-merchant
```

### Hook into existing admin product API routes

Find the files handling product create/update/delete in your admin.
**Read each file before editing.** Then add these calls:

In **product create** handler, after successful Supabase insert:
```ts
import { upsertMerchantProduct, notifyGoogleIndexing } from '@/lib/google-sync';

// After product is saved to Supabase:
upsertMerchantProduct(newProduct).catch(console.error);
notifyGoogleIndexing(
  `https://www.reveilfragrance.in/products/${newProduct.slug}`,
  'URL_UPDATED'
).catch(console.error);
```

In **product update** handler, after successful Supabase update:
```ts
upsertMerchantProduct(updatedProduct).catch(console.error);
notifyGoogleIndexing(
  `https://www.reveilfragrance.in/products/${updatedProduct.slug}`,
  'URL_UPDATED'
).catch(console.error);
```

In **product delete** handler, before Supabase delete:
```ts
deleteMerchantProduct(productToDelete).catch(console.error);
notifyGoogleIndexing(
  `https://www.reveilfragrance.in/products/${productToDelete.slug}`,
  'URL_DELETED'
).catch(console.error);
// then proceed with supabase delete
```

---

## SECTION F — FIX RESTRICTED ADULT CONTENT FLAG

### What is happening
Google flagged some products for "Restricted adult content". This happens with fragrances
because certain common fragrance marketing words trigger Google's adult content filter.

### Words to audit and replace in ALL product names and descriptions

Check every product in the Supabase `products` table. Find and replace:

| Flagged word/phrase | Safe replacement |
|---|---|
| "sensual" | "warm" or "captivating" |
| "seductive" | "alluring" or "enchanting" |
| "sexy" | "bold" or "confident" |
| "arousing" | "invigorating" |
| "erotic" | remove entirely |
| "intimate" (in certain contexts) | "personal" or "close-wear" |
| Any explicit body reference | remove entirely |

For products like "Choco Musk" — the product itself is fine. Check if the description
contains any flagged words. Musk as a fragrance note is acceptable; sexual context is not.

### Fix in admin panel
Add a content review step in the admin product form. Before a product is saved,
check the description for flagged words and show a warning. The check:

```ts
// lib/content-check.ts
const FLAGGED_WORDS = [
  'sensual', 'seductive', 'sexy', 'arousing', 'erotic', 'intimate arousal',
  'explicit', 'adult only', 'for adults',
];

export function checkForFlaggedContent(text: string): string[] {
  const lower = text.toLowerCase();
  return FLAGGED_WORDS.filter((word) => lower.includes(word));
}
```

Use in admin product form:
```tsx
import { checkForFlaggedContent } from '@/lib/content-check';

// Before saving:
const flagged = checkForFlaggedContent(
  `${formData.name} ${formData.description} ${formData.meta_description}`
);
if (flagged.length > 0) {
  // Show warning — do not block save, just warn admin
  alert(
    `Warning: The following words may cause Google to flag this product as ` +
    `"Restricted adult content": ${flagged.join(', ')}. ` +
    `Consider replacing them before saving.`
  );
}
```

---

## SECTION G — ADMIN PANEL: ADD PRODUCT FIELDS FOR SEO AND MERCHANT CENTER

Find the admin product create/edit form. Read the file first.
Add these fields to the form if they don't already exist:

```tsx
// Add to admin product create/edit form

{/* SEO Fields */}
<fieldset className="rounded-xl border border-gray-200 p-4">
  <legend className="px-2 text-sm font-semibold text-gray-700">
    SEO & Google Merchant Center
  </legend>

  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600">
        SEO Title (meta_title) — max 60 chars
      </label>
      <input name="meta_title" maxLength={60}
        placeholder="e.g. Reveil Choco Musk Roll On 6ml | Attar Perfume"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
    </div>

    <div>
      <label className="block text-xs font-medium text-gray-600">
        SEO Description (meta_description) — max 160 chars
      </label>
      <textarea name="meta_description" maxLength={160} rows={2}
        placeholder="e.g. Reveil Choco Musk Roll On — a rich chocolatey attar for long-lasting fragrance. 6ml roll-on bottle."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
    </div>

    <div>
      <label className="block text-xs font-medium text-gray-600">
        URL Slug — auto-generated, edit if needed
      </label>
      <input name="slug"
        placeholder="e.g. reveil-choco-musk-roll-on-6ml"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600">
          Unit (ml / g / fl oz)
        </label>
        <select name="unit"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="ml">ml (millilitres)</option>
          <option value="g">g (grams)</option>
          <option value="fl oz">fl oz</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600">
          Volume/Weight (e.g. 50, 6, 100)
        </label>
        <input name="unit_pricing_base_measure" type="number"
          placeholder="e.g. 50"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
    </div>

    <div>
      <label className="block text-xs font-medium text-gray-600">
        Shipping Weight (kg) — e.g. 0.2 for a 50ml bottle
      </label>
      <input name="shipping_weight" type="number" step="0.01" min="0.01"
        placeholder="0.2"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
    </div>
  </div>
</fieldset>
```

---

## SECTION H — OPEN GRAPH TAGS FOR ALL PAGES

Every page that crawlers can reach must have Open Graph meta tags.
These make products visible in social shares and help Google understand the content.

### Add to root layout: `app/layout.tsx`

Find `app/layout.tsx`. Read it. Add this to the `metadata` export if it's not already there:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://www.reveilfragrance.in'),
  title: {
    default: 'Reveil Fragrance — Premium Perfumes, Attars & Scents',
    template: '%s | Reveil Fragrance',
  },
  description:
    'Shop Reveil Fragrance for premium perfumes, attars, deodorants, oudh, musk, ' +
    'floral scents and car fresheners. Free shipping across India.',
  keywords: [
    'perfume India', 'attar', 'deodorant', 'oudh', 'musk perfume',
    'car freshener', 'air freshener', 'reveil fragrance',
  ],
  openGraph: {
    siteName: 'Reveil Fragrance',
    locale: 'en_IN',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};
```

---

## SECTION I — GOOGLE MERCHANT CENTER: MANUAL SHIPPING SETUP (DO THIS IN DASHBOARD)

The `shipping` field in the product JSON-LD and Merchant Center API payload sets the
schema-level data. But Google Merchant Center **also requires** shipping to be configured
at the account level. Do this manually:

1. Go to https://merchants.google.com (Merchant Center ID: `5810608440`)
2. Left menu → **Products & Store** → **Shipping and Returns**
3. Under **Shipping policies** tab → click **Add shipping policy**
4. Select **Shipping for online products**
5. Configure:
   - **Shipping service name**: "Standard Free Shipping India"
   - **Delivery country**: India
   - **Transit time**: 3–7 business days
   - **Shipping rate**: Free (₹0)
6. Click **Save**

Also configure Return Policy:
1. Still in Shipping and Returns → click **Return policies** tab
2. Add return policy:
   - **Policy name**: "7 Day Return Policy"
   - **Return window**: 7 days
   - **Return method**: By mail
   - **Return fees**: Free
3. Save

After saving both, Google will re-evaluate all products within 24–72 hours.

---

## SECTION J — ENVIRONMENT VARIABLES

Ensure all of these exist in `.env.local` and in Vercel environment settings:

```env
# Supabase — all three are required
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Google — service account JSON as a single-line string
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...FULL JSON HERE..."}
# Note: GOOGLE_MERCHANT_ID is now hardcoded as 5810608440 in lib/google-sync.ts
# If you want it as an env var instead, add:
# GOOGLE_MERCHANT_ID=5810608440

# iCarry
ICARRY_USERNAME=ela25039
ICARRY_API_KEY=QYGuax1t5miPwX3EFzkZqojsV5yMnUUzkq9lhU1D9svXrSIyk4oWrdFZsdMQdzL33R33kyLkFcKvdoXLusgV2DM2dT8DTuIujLTHd78bfnrCJHGp13ySjBth3cNvI7p1bkwi4j81iwyzsH2MHqPDGc0UZmnLDdW5a6XA2IK9L5diPGXZO7EseGk7WDFN5FSq0obV4n9aHhrT5SgfwnDGgV0K7RplQZHdHMnIPrhJSSu9gyscJQO80C4xs1mfi0n5
ICARRY_PICKUP_ADDRESS_ID=your_pickup_address_id

# Resend — should already be set
RESEND_API_KEY=re_your_key_here
```

---

## SECTION K — IMPLEMENTATION ORDER

Execute in this exact sequence. Do not skip steps:

1. Run all SQL in **Section A** in Supabase SQL Editor
2. Create `app/robots.txt/route.ts` (**Section C**)
3. Delete `public/sitemap.xml`, create `app/sitemap.xml/route.ts` (**Section C**)
4. Convert shop page `app/products/page.tsx` to server component (**Section B**)
5. Convert product detail `app/products/[slug]/page.tsx` to server component (**Section D Step 1**)
6. Create `components/ProductSchema.tsx` (**Section D Step 2**)
7. Add metadata export to `app/layout.tsx` (**Section H**)
8. Install `googleapis`, create `lib/google-sync.ts` (**Section E**)
9. Create `app/api/admin/sync-merchant/route.ts` (**Section E**)
10. Hook `upsertMerchantProduct` + `notifyGoogleIndexing` into product CRUD API routes (**Section E**)
11. Add SEO fields to admin product form (**Section G**)
12. Add `checkForFlaggedContent` warning to admin form (**Section F**)
13. Deploy to Vercel / production
14. Verify sitemap live at `https://www.reveilfragrance.in/sitemap.xml` — must show ALL products
15. Verify robots.txt at `https://www.reveilfragrance.in/robots.txt`
16. Call `POST /api/admin/sync-merchant` once to bulk-push all products to Merchant Center
17. Set up shipping and return policy in Merchant Center dashboard (**Section I**)
18. Go to Google Search Console → Sitemaps → submit `https://www.reveilfragrance.in/sitemap.xml`
19. Go to Google Search Console → URL Inspection → test 3 product URLs → Request Indexing for each
20. Go to Google Merchant Center → Products → verify products are appearing and approved

---

## SECTION L — VERIFICATION CHECKLIST

After all changes are deployed, verify each of these:

| Check | How to verify |
|---|---|
| All products in sitemap | Open `https://www.reveilfragrance.in/sitemap.xml` — count `<url>` entries, should equal your total active products count |
| Product pages server-rendered | Right-click any product page → View Page Source → you should see product name and description in the raw HTML, not just empty divs |
| JSON-LD on product page | View page source on any product page → search for `application/ld+json` — the full schema should be there |
| aggregateRating in schema | Check the JSON-LD — `aggregateRating` block should be present for products with reviews |
| Sitemap submitted | Google Search Console → Sitemaps → status should show "Success" |
| Merchant Center products | Merchant Center → Products → All products tab — all products should appear within 24h |
| No adult content flags | Merchant Center → Products → Needs attention — the "Restricted adult content" issue should clear within 24-72h after product descriptions are cleaned |
| Shipping costs set | Merchant Center → Products → Needs attention — "Missing shipping costs" should be gone after Section I is done |
