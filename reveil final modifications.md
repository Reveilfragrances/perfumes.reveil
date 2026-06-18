# MASTER PROMPT — REVEIL FRAGRANCE WEBSITE
## Complete Implementation Guide — All Fixes & Features

---
act as a senior software developer and fix all the issues and the modifications
strictly do not hamper any other functionality , and try to fix ony , do not change any other working functionality. or any other UI 
You may do the modifications , but do not delete any existing functionality.

## TECH STACK (CONFIRMED — DO NOT DEVIATE)
- **Frontend + Backend**: Next.js (App Router — use `app/` directory conventions)
- **Styling**: Tailwind CSS only — no inline style objects, no CSS modules unless stated
- **Database**: Supabase (PostgreSQL) — use `@supabase/supabase-js` client
- **Email**: Resend API — already integrated, use existing Resend client instance
- **Shipping (existing)**: Shiprocket — already integrated, keep all existing code untouched
- **Admin Panel**: Already exists at `/admin` route — extend it, do not rebuild it

## DEVELOPMENT APPROACH
Use **sequential thinking** for every section:
1. First **read** every relevant existing file before touching it
2. **Plan** the change with comments before writing code
3. **Write** one file at a time, complete each file fully before moving to the next
4. **Verify** imports match actual existing file paths in the project
5. Never delete existing working code — only extend or append

---

## SECTION 1 — DYNAMIC SITEMAP

### What is broken
The current `/sitemap.xml` is a static file. It has hardcoded category slugs that do not
exist in the database, it contains zero individual product URLs, and it never updates
when the admin adds, modifies, or deletes products.

### What to build
A fully dynamic sitemap generated from live Supabase data on every request.

---

### Step 1 — Verify your Supabase `products` table has these columns

Check Supabase Dashboard → Table Editor → `products` table.
If any column is missing, add it via Supabase SQL Editor:

```sql
-- Run these in Supabase SQL Editor only if the columns do not already exist

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-generate slug from name if slug is null (run once to backfill)
UPDATE products
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
```

Also check that your `categories` table has a `slug` column. If not:
```sql
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
UPDATE categories SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;
```

---

### Step 2 — Delete the static sitemap file

Delete the file: `public/sitemap.xml`
This file must not exist — Next.js will serve your dynamic route instead.

---

### Step 3 — Create the dynamic sitemap route

Create file: `app/sitemap.xml/route.ts`

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // use service role key here — server only
);

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const baseUrl = 'https://www.reveilfragrance.in';
  const now = new Date().toISOString();

  // Fetch all active products — select only needed columns
  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at, meta_title, images')
    .eq('is_active', true)   // only include active/published products
    .order('updated_at', { ascending: false });

  // Fetch all active categories
  const { data: categories } = await supabase
    .from('categories')
    .select('slug, updated_at')
    .eq('is_active', true);

  const staticPages = [
    { url: '/',          changefreq: 'daily',   priority: '1.0'  },
    { url: '/products',  changefreq: 'daily',   priority: '0.95' },
    { url: '/about',     changefreq: 'monthly', priority: '0.6'  },
    { url: '/contact',   changefreq: 'monthly', priority: '0.5'  },
    { url: '/shipping',  changefreq: 'monthly', priority: '0.4'  },
    { url: '/refund',    changefreq: 'monthly', priority: '0.4'  },
    { url: '/terms',     changefreq: 'yearly',  priority: '0.3'  },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset 
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${staticPages.map(p => `  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}

${(categories || []).map(cat => `  <url>
    <loc>${baseUrl}/products?category=${encodeURIComponent(cat.slug.toUpperCase())}</loc>
    <lastmod>${cat.updated_at ? new Date(cat.updated_at).toISOString() : now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`).join('\n')}

${(products || []).map(product => `  <url>
    <loc>${baseUrl}/products/${product.slug}</loc>
    <lastmod>${product.updated_at ? new Date(product.updated_at).toISOString() : now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>${product.images?.[0] ? `
    <image:image>
      <image:loc>${escapeXml(product.images[0])}</image:loc>
      <image:title>${escapeXml(product.meta_title || product.slug)}</image:title>
    </image:image>` : ''}
  </url>`).join('\n')}

</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
```

---

### Step 4 — Admin panel: auto-generate slug when saving a product

In your existing admin product save handler (find the file that handles product 
create/update in `/app/admin/` or `/app/api/admin/products/`), add slug generation:

```ts
// Add this utility function at the top of the file
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

// When creating a product, before the supabase insert:
if (!productData.slug) {
  productData.slug = generateSlug(productData.name);
}

// Enforce SKU max 40 characters (fixes Google Search Console error)
if (productData.sku) {
  productData.sku = String(productData.sku).substring(0, 40);
} else {
  // Auto-generate SKU if blank
  productData.sku = `REVEIL-${Date.now().toString(36).toUpperCase()}`;
}
```

Also add `slug`, `meta_title`, `meta_description`, `meta_keywords` fields to the 
admin product creation and edit form UI if they are not already there.

---

## SECTION 2 — GOOGLE SEARCH CONSOLE ERRORS (Structured Data / Schema.org)

### Errors to fix (all 4 from screenshots)

| Error | Fix |
|-------|-----|
| Missing field `hasMerchantReturnPolicy` in offers | Add to JSON-LD schema |
| Invalid string length in field `sku` | Enforce max 40 chars |
| Missing field `review` (Product Snippets) | Add review data from Supabase |
| Missing field `aggregateRating` (Product Snippets) | Add rating data from Supabase |

---

### Step 1 — Verify/add review columns to Supabase

```sql
-- Run in Supabase SQL Editor only if these tables/columns don't exist yet

-- If you have a reviews table already, skip the CREATE TABLE
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  author_name TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add aggregate columns to products table for fast reads
ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Function to auto-update aggregate rating when a review is added/updated
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0) FROM reviews 
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
      AND is_approved = true
    ),
    review_count = (
      SELECT COUNT(*) FROM reviews 
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
      AND is_approved = true
    )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rating_on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE PROCEDURE update_product_rating();
```

---

### Step 2 — Create ProductSchema component

Create file: `components/ProductSchema.tsx`

```tsx
interface Review {
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface Product {
  name: string;
  slug: string;
  description: string;
  meta_description?: string;
  sku?: string;
  id: string;
  images?: string[];
  price: number;
  stock: number;
  average_rating?: number;
  review_count?: number;
  reviews?: Review[];
}

export default function ProductSchema({ product }: { product: Product }) {
  const sku = product.sku
    ? String(product.sku).substring(0, 40)
    : `REVEIL-${product.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.meta_description || product.description,
    sku: sku,
    mpn: sku,
    brand: { '@type': 'Brand', name: 'Reveil Fragrance' },
    image: product.images || [],
    url: `https://www.reveilfragrance.in/products/${product.slug}`,
  };

  // aggregateRating — only include when reviews exist (fixes "Missing aggregateRating" error)
  if (product.review_count && product.review_count > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.average_rating || 4).toFixed(1),
      reviewCount: product.review_count,
      bestRating: '5',
      worstRating: '1',
    };
  }

  // review — only include when reviews exist (fixes "Missing review" error)
  if (product.reviews && product.reviews.length > 0) {
    schema.review = product.reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: String(r.rating),
        bestRating: '5',
      },
      author: { '@type': 'Person', name: r.author_name || 'Verified Buyer' },
      reviewBody: r.comment || '',
      datePublished: new Date(r.created_at).toISOString().split('T')[0],
    }));
  }

  schema.offers = {
    '@type': 'Offer',
    url: `https://www.reveilfragrance.in/products/${product.slug}`,
    priceCurrency: 'INR',
    price: String(product.price),
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
      url: 'https://www.reveilfragrance.in',
    },
    // shippingDetails — required for Merchant Listings
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: '0',
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
    // hasMerchantReturnPolicy — fixes "Missing hasMerchantReturnPolicy" warning
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

### Step 3 — Use ProductSchema in product page

Find your product page file. It will be at:
`app/products/[slug]/page.tsx`

In the `generateMetadata` export and the page component, add:

```tsx
import ProductSchema from '@/components/ProductSchema';
import { createClient } from '@supabase/supabase-js';

// In the page component, fetch reviews alongside product:
const { data: reviews } = await supabase
  .from('reviews')
  .select('author_name, rating, comment, created_at')
  .eq('product_id', product.id)
  .eq('is_approved', true)
  .order('created_at', { ascending: false })
  .limit(5);

const productWithReviews = { ...product, reviews: reviews || [] };

// In the JSX return:
return (
  <>
    <ProductSchema product={productWithReviews} />
    {/* rest of existing product page JSX unchanged */}
  </>
);
```

Also update `generateMetadata` to use `meta_title` and `meta_description` from Supabase:
```tsx
export async function generateMetadata({ params }: { params: { slug: string } }) {
  // fetch product from supabase by slug
  return {
    title: `${product.meta_title || product.name} | Reveil Fragrance`,
    description: product.meta_description || product.description?.substring(0, 160),
    keywords: product.meta_keywords || '',
  };
}
```

---

## SECTION 3 — GOOGLE MERCHANT CENTER AUTO-SYNC

### What this does
When the admin adds, edits, or deletes a product in the admin panel, it automatically
syncs to Google Merchant Center so products appear in Google Shopping without any
manual submission.

---

### Step 1 — Setup Google Service Account (admin does this manually once)

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. APIs & Services → Enable **"Content API for Shopping"** and **"Web Search Indexing API"**
4. IAM & Admin → Service Accounts → Create Service Account
5. Name it `reveil-merchant-sync`, click Create
6. Grant role: **Owner** (or "Editor")
7. Click the service account → Keys tab → Add Key → JSON → Download
8. The downloaded file is your `GOOGLE_SERVICE_ACCOUNT_JSON`
9. Go to https://merchants.google.com → Settings → Users → Add User
   → Enter the service account email (looks like `reveil-merchant-sync@your-project.iam.gserviceaccount.com`)
   → Give it **Admin** access
10. Go to https://search.google.com/search-console → Settings → Users and permissions
    → Add the same service account email as **Owner**

---

### Step 2 — Install googleapis

```bash
npm install googleapis
```

---

### Step 3 — Create Google integration utility

Create file: `lib/google-sync.ts`

```ts
import { google } from 'googleapis';

// Parse service account JSON from env — stored as a single-line stringified JSON
const serviceAccountCredentials = JSON.parse(
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON!
);

const MERCHANT_ID = process.env.GOOGLE_MERCHANT_ID!;

function getGoogleAuth(scopes: string[]) {
  return new google.auth.GoogleAuth({
    credentials: serviceAccountCredentials,
    scopes,
  });
}

// ─── Google Indexing API: notify Google when a product URL changes ───────────

export async function notifyGoogleIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
) {
  try {
    const auth = getGoogleAuth([
      'https://www.googleapis.com/auth/indexing',
    ]);
    const client = await auth.getClient();
    const indexing = google.indexing({ version: 'v3', auth: client as never });
    await indexing.urlNotifications.publish({
      requestBody: { url, type },
    });
  } catch (err: unknown) {
    // Non-fatal — log and continue
    console.error('[Google Indexing]', (err as Error).message);
  }
}

// ─── Google Merchant Center: push product to Shopping feed ───────────────────

function buildMerchantPayload(product: {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sku?: string;
  price: number;
  stock: number;
  images?: string[];
  category?: string;
}) {
  const sku = product.sku
    ? String(product.sku).substring(0, 40)
    : `REVEIL-${product.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

  return {
    offerId: sku,
    title: product.name,
    description: (product.description || product.name).substring(0, 5000),
    link: `https://www.reveilfragrance.in/products/${product.slug}`,
    imageLink: product.images?.[0] || '',
    additionalImageLinks: product.images?.slice(1, 10) || [],
    contentLanguage: 'en',
    targetCountry: 'IN',
    channel: 'online',
    availability: product.stock > 0 ? 'in stock' : 'out of stock',
    condition: 'new',
    price: { value: String(product.price), currency: 'INR' },
    brand: 'Reveil Fragrance',
    mpn: sku,
    googleProductCategory: '2915', // Fragrances — do not change this number
    shipping: [
      {
        country: 'IN',
        service: 'Standard',
        price: { value: '0', currency: 'INR' },
      },
    ],
  };
}

export async function upsertMerchantProduct(product: Parameters<typeof buildMerchantPayload>[0]) {
  try {
    const auth = getGoogleAuth([
      'https://www.googleapis.com/auth/content',
    ]);
    const client = await auth.getClient();
    const content = google.content({ version: 'v2.1', auth: client as never });
    await content.products.insert({
      merchantId: MERCHANT_ID,
      requestBody: buildMerchantPayload(product),
    });
  } catch (err: unknown) {
    console.error('[Merchant Center upsert]', (err as Error).message);
  }
}

export async function deleteMerchantProduct(product: { id: string; sku?: string; slug: string }) {
  try {
    const sku = product.sku
      ? String(product.sku).substring(0, 40)
      : `REVEIL-${product.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;
    const auth = getGoogleAuth([
      'https://www.googleapis.com/auth/content',
    ]);
    const client = await auth.getClient();
    const content = google.content({ version: 'v2.1', auth: client as never });
    await content.products.delete({
      merchantId: MERCHANT_ID,
      productId: `online:en:IN:${sku}`,
    });
  } catch (err: unknown) {
    console.error('[Merchant Center delete]', (err as Error).message);
  }
}
```

---

### Step 4 — Hook into existing admin product API routes

Find the files that handle product create, update, and delete in the admin.
They will be somewhere like `app/api/admin/products/route.ts` and
`app/api/admin/products/[id]/route.ts`.

**Do not rewrite these files. Only add the following calls at the end of each handler:**

In the **POST handler** (create product), after the Supabase insert succeeds:
```ts
import { upsertMerchantProduct, notifyGoogleIndexing } from '@/lib/google-sync';

// After: const { data: newProduct } = await supabase.from('products').insert(...)
await upsertMerchantProduct(newProduct);
await notifyGoogleIndexing(
  `https://www.reveilfragrance.in/products/${newProduct.slug}`,
  'URL_UPDATED'
);
```

In the **PUT/PATCH handler** (update product), after the Supabase update succeeds:
```ts
await upsertMerchantProduct(updatedProduct);
await notifyGoogleIndexing(
  `https://www.reveilfragrance.in/products/${updatedProduct.slug}`,
  'URL_UPDATED'
);
```

In the **DELETE handler**, before the Supabase delete:
```ts
await deleteMerchantProduct(productToDelete);
await notifyGoogleIndexing(
  `https://www.reveilfragrance.in/products/${productToDelete.slug}`,
  'URL_DELETED'
);
// then proceed with supabase delete
```

---

## SECTION 4 — ORDER NOTIFICATION EMAIL TO ADMIN

### What this does
When a customer places an order on the website, immediately send a full order details
email to `reveilfragrances@gmail.com` using the existing Resend integration, notifying
the admin to check the admin panel and accept/process the order.

---

### Step 1 — Create admin order notification email template

Create file: `emails/AdminOrderNotification.tsx`

```tsx
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface AdminOrderEmailProps {
  orderId: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: OrderItem[];
  subtotal: number;
  couponCode?: string;
  couponDiscount?: number;
  shippingFee: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
}

export function AdminOrderNotificationEmail({
  orderId,
  orderDate,
  customerName,
  customerEmail,
  customerPhone,
  shippingAddress,
  items,
  subtotal,
  couponCode,
  couponDiscount,
  shippingFee,
  totalAmount,
  paymentMethod,
  paymentStatus,
}: AdminOrderEmailProps) {
  const adminPanelUrl = `https://www.reveilfragrance.in/admin/orders/${orderId}`;

  return (
    // Use plain HTML string for Resend compatibility
    // Return the HTML as a string from a helper function instead if using react-email
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ background: '#1a1a1a', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ color: '#ffd700', margin: 0, fontSize: '22px' }}>
          🛍️ New Order Received — Reveil Fragrance
        </h1>
      </div>

      <div style={{ background: '#fff9f0', padding: '20px', borderBottom: '2px solid #ffd700' }}>
        <p style={{ margin: 0, fontSize: '16px', color: '#333' }}>
          A new order has been placed. Please log in to the admin panel to review and 
          process it.
        </p>
        <a
          href={adminPanelUrl}
          style={{
            display: 'inline-block',
            marginTop: '16px',
            background: '#1a1a1a',
            color: '#ffd700',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 'bold',
          }}
        >
          View Order in Admin Panel →
        </a>
      </div>

      <div style={{ padding: '20px', background: '#ffffff' }}>
        <h2 style={{ fontSize: '16px', color: '#1a1a1a', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
          Order Summary
        </h2>
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Order ID</td>
              <td style={{ fontWeight: 'bold', textAlign: 'right' }}>#{orderId.substring(0, 8).toUpperCase()}</td></tr>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Date</td>
              <td style={{ textAlign: 'right' }}>{orderDate}</td></tr>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Payment Method</td>
              <td style={{ textAlign: 'right' }}>{paymentMethod}</td></tr>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Payment Status</td>
              <td style={{ textAlign: 'right', color: paymentStatus === 'paid' ? 'green' : 'orange', fontWeight: 'bold' }}>
                {paymentStatus.toUpperCase()}</td></tr>
        </table>

        <h2 style={{ fontSize: '16px', color: '#1a1a1a', borderBottom: '1px solid #eee', paddingBottom: '8px', marginTop: '20px' }}>
          Customer Details
        </h2>
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Name</td>
              <td style={{ textAlign: 'right' }}>{customerName}</td></tr>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Email</td>
              <td style={{ textAlign: 'right' }}>{customerEmail}</td></tr>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Phone</td>
              <td style={{ textAlign: 'right' }}>{customerPhone}</td></tr>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Shipping Address</td>
              <td style={{ textAlign: 'right' }}>
                {shippingAddress.line1}, {shippingAddress.city},<br />
                {shippingAddress.state} — {shippingAddress.pincode}
              </td></tr>
        </table>

        <h2 style={{ fontSize: '16px', color: '#1a1a1a', borderBottom: '1px solid #eee', paddingBottom: '8px', marginTop: '20px' }}>
          Items Ordered
        </h2>
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Product</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{item.name}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>
                  ₹{(item.price * item.quantity).toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <table style={{ width: '100%', fontSize: '14px', marginTop: '12px', borderCollapse: 'collapse' }}>
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Subtotal</td>
              <td style={{ textAlign: 'right' }}>₹{subtotal}</td></tr>
          {couponCode && (
            <tr><td style={{ color: '#22a06b', padding: '4px 0' }}>
                  Coupon ({couponCode})</td>
                <td style={{ textAlign: 'right', color: '#22a06b' }}>−₹{couponDiscount}</td></tr>
          )}
          <tr><td style={{ color: '#666', padding: '4px 0' }}>Shipping</td>
              <td style={{ textAlign: 'right' }}>
                {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
              </td></tr>
          <tr style={{ borderTop: '2px solid #1a1a1a' }}>
            <td style={{ fontWeight: 'bold', padding: '8px 0', fontSize: '16px' }}>Total</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px', color: '#1a1a1a' }}>
              ₹{totalAmount}
            </td></tr>
        </table>
      </div>

      <div style={{ background: '#f5f5f5', padding: '16px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
        This email was sent automatically by Reveil Fragrance order system.<br />
        Do not reply to this email. Manage orders at: {adminPanelUrl}
      </div>
    </div>
  );
}
```

---

### Step 2 — Create the admin notification sender function

Create file: `lib/notify-admin-order.ts`

```ts
import { Resend } from 'resend';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminOrderNotificationEmail } from '@/emails/AdminOrderNotification';

// Use the EXISTING Resend instance/import from your project
// If your project exports a resend client, import it here instead of creating a new one
const resend = new Resend(process.env.RESEND_API_KEY!);

const ADMIN_EMAIL = 'reveilfragrances@gmail.com';

export async function sendAdminOrderNotification(order: {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: { line1: string; city: string; state: string; pincode: string };
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  coupon_code?: string;
  coupon_discount?: number;
  shipping_fee: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
}) {
  try {
    const html = renderToStaticMarkup(
      AdminOrderNotificationEmail({
        orderId: order.id,
        orderDate: new Date(order.created_at).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        shippingAddress: order.shipping_address,
        items: order.items,
        subtotal: order.subtotal,
        couponCode: order.coupon_code,
        couponDiscount: order.coupon_discount,
        shippingFee: order.shipping_fee,
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
      })
    );

    await resend.emails.send({
      from: 'Reveil Fragrance Orders <orders@reveilfragrance.in>',
      // NOTE: the 'from' domain must be verified in Resend dashboard
      // If reveilfragrance.in is not yet verified in Resend, use your verified domain
      to: ADMIN_EMAIL,
      subject: `🛍️ New Order #${order.id.substring(0, 8).toUpperCase()} — ₹${order.total_amount} — ${order.customer_name}`,
      html,
    });
  } catch (err: unknown) {
    // Non-fatal: log the error but do not block order creation
    console.error('[Admin Order Email]', (err as Error).message);
  }
}
```

---

### Step 3 — Call the notification in the order creation API

Find the file that handles order creation (e.g. `app/api/orders/route.ts` or
`app/api/checkout/route.ts`). After the Supabase order insert succeeds, add:

```ts
import { sendAdminOrderNotification } from '@/lib/notify-admin-order';

// After: const { data: newOrder } = await supabase.from('orders').insert(...)
// This runs in the background — do not await it (don't delay the customer response)
sendAdminOrderNotification(newOrder).catch(console.error);
```

---

## SECTION 5 — SHIPPING: ICARRY + MANUAL DELIVERY

### What to build
Keep all existing Shiprocket code completely untouched. Add two new shipping providers
(iCarry and Manual) that the admin can choose per order from the admin orders panel.
The customer-facing checkout flow does not change — the customer still places an order
normally. The shipping provider is selected by the admin AFTER the order is received.

---

### Step 1 — Add shipping fields to the orders table in Supabase

```sql
-- Run in Supabase SQL Editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider TEXT DEFAULT 'pending';
-- Values: 'pending' | 'shiprocket' | 'icarry' | 'manual'

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_awb TEXT;
-- AWB/tracking number from the chosen provider

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;
-- PDF label URL

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_status TEXT DEFAULT 'pending';
-- e.g. 'pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'

ALTER TABLE orders ADD COLUMN IF NOT EXISTS manual_delivery_note TEXT;
-- Only used when shipping_provider = 'manual'

ALTER TABLE orders ADD COLUMN IF NOT EXISTS icarry_awb TEXT;
-- iCarry-specific AWB for easy lookup in webhooks
```

---

### Step 2 — Create iCarry utility library

Create file: `lib/shipping/icarry.ts`

```ts
// iCarry.in Shipping Integration
// API docs: https://www.icarry.in/shipping-api-plugins-extensions

const ICARRY_BASE_URL = 'https://www.icarry.in/api';

// Token cache — tokens expire, so we cache with a timestamp
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getIcarryToken(): Promise<string> {
  // Return cached token if still valid (cache for 50 minutes)
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch(`${ICARRY_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.ICARRY_USERNAME,
      api_key: process.env.ICARRY_API_KEY,
    }),
  });

  if (!res.ok) {
    throw new Error(`iCarry login failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  // Adjust 'data.token' to the actual field name returned by iCarry API
  const token = data.token || data.auth_token || data.access_token;

  cachedToken = {
    token,
    expiresAt: Date.now() + 50 * 60 * 1000, // 50 minutes
  };

  return token;
}

async function icarryRequest(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
) {
  const token = await getIcarryToken();
  const res = await fetch(`${ICARRY_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `iCarry API error on ${path}: ${res.status} — ${JSON.stringify(data)}`
    );
  }

  return data;
}

// Check if iCarry delivers to a pincode
export async function checkIcarryServiceability(pincode: string) {
  return icarryRequest(`/serviceability?pincode=${pincode}`);
}

// Get shipping rate estimate
export async function getIcarryEstimate(params: {
  fromPincode: string;
  toPincode: string;
  weight: number;
  length?: number;
  breadth?: number;
  height?: number;
}) {
  return icarryRequest('/estimate/domestic', 'POST', {
    origin_pincode: params.fromPincode,
    destination_pincode: params.toPincode,
    weight: params.weight,
    length: params.length || 15,
    breadth: params.breadth || 10,
    height: params.height || 5,
  });
}

// Book a shipment
export async function bookIcarryShipment(order: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: { line1: string; city: string; state: string; pincode: string };
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  paymentMethod: string;
  weight?: number;
}) {
  return icarryRequest('/shipment/book', 'POST', {
    order_id: order.orderId,
    pickup_address_id: process.env.ICARRY_PICKUP_ADDRESS_ID,
    delivery_name: order.customerName,
    delivery_address: order.shippingAddress.line1,
    delivery_city: order.shippingAddress.city,
    delivery_state: order.shippingAddress.state,
    delivery_pincode: order.shippingAddress.pincode,
    delivery_phone: order.customerPhone,
    weight: order.weight || 0.5,
    length: 15,
    breadth: 10,
    height: 5,
    cod_amount: order.paymentMethod === 'COD' ? order.totalAmount : 0,
    declared_value: order.totalAmount,
    items: order.items.map((i) => ({
      name: i.name,
      qty: i.quantity,
      price: i.price,
    })),
  });
}

// Track a shipment by AWB number
export async function trackIcarryShipment(awb: string) {
  return icarryRequest(`/track/${awb}`);
}

// Cancel a shipment
export async function cancelIcarryShipment(awb: string) {
  return icarryRequest('/shipment/cancel', 'POST', { awb });
}

// Get printable shipping label
export async function getIcarryLabel(awb: string) {
  return icarryRequest(`/label/${awb}`);
}
```

---

### Step 3 — Create webhook handlers for iCarry

Create file: `app/api/webhooks/icarry/status/route.ts`
```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const { awb, status, order_id } = body;

  if (!awb) return new Response('Missing awb', { status: 400 });

  await supabase
    .from('orders')
    .update({
      shipping_status: status?.toLowerCase() || 'unknown',
      updated_at: new Date().toISOString(),
    })
    .or(`icarry_awb.eq.${awb},shipping_awb.eq.${awb}`);

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

Create file: `app/api/webhooks/icarry/ndr/route.ts`
```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const { awb, reason } = body;

  await supabase
    .from('orders')
    .update({
      shipping_status: 'ndr',
      manual_delivery_note: `NDR: ${reason || 'Delivery attempted, not delivered'}`,
      updated_at: new Date().toISOString(),
    })
    .or(`icarry_awb.eq.${awb},shipping_awb.eq.${awb}`);

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

Create file: `app/api/webhooks/icarry/weight-dispute/route.ts`
```ts
export async function POST(req: Request) {
  const body = await req.json();
  // Log weight dispute for admin review — store in a disputes table or just log
  console.log('[iCarry Weight Dispute]', JSON.stringify(body));
  // Optionally: insert into a `shipping_disputes` table in Supabase
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

---

### Step 4 — API routes for shipping actions

Create file: `app/api/admin/orders/[id]/ship/route.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import { bookIcarryShipment } from '@/lib/shipping/icarry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { provider, manualNote } = await req.json();
  // provider: 'shiprocket' | 'icarry' | 'manual'

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!order) {
    return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
  }

  if (provider === 'icarry') {
    const result = await bookIcarryShipment({
      orderId: order.id,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      shippingAddress: order.shipping_address,
      items: order.items,
      totalAmount: order.total_amount,
      paymentMethod: order.payment_method,
      weight: order.weight || 0.5,
    });

    // Adjust field names based on actual iCarry API response
    const awb = result.awb || result.tracking_number || result.shipment_id;

    await supabase.from('orders').update({
      shipping_provider: 'icarry',
      icarry_awb: awb,
      shipping_awb: awb,
      shipping_status: 'processing',
    }).eq('id', params.id);

    return new Response(JSON.stringify({ success: true, awb, provider: 'icarry' }), { status: 200 });
  }

  if (provider === 'shiprocket') {
    // Call your EXISTING Shiprocket booking function here
    // Import it from wherever you have it, e.g.:
    // const { bookShiprocketOrder } = await import('@/lib/shipping/shiprocket');
    // const result = await bookShiprocketOrder(order);
    // Then update the DB similarly
    // DO NOT rewrite the Shiprocket code — just call it here
    return new Response(
      JSON.stringify({ message: 'Connect existing Shiprocket booking here' }),
      { status: 200 }
    );
  }

  if (provider === 'manual') {
    await supabase.from('orders').update({
      shipping_provider: 'manual',
      shipping_status: 'processing',
      manual_delivery_note: manualNote || 'Order dispatched manually',
    }).eq('id', params.id);

    return new Response(
      JSON.stringify({ success: true, provider: 'manual' }),
      { status: 200 }
    );
  }

  return new Response(JSON.stringify({ error: 'Invalid provider' }), { status: 400 });
}
```

---

### Step 5 — Admin panel: Order view UI changes

Find the admin order detail page file. It will be at a path like 
`app/admin/orders/[id]/page.tsx` or `app/admin/orders/[id]/page.jsx`.

Do NOT rebuild this page. Find the section that shows the order card/detail and 
**append** this shipping action panel below the existing content:

```tsx
'use client';
import { useState } from 'react';

// Add this component at the bottom of the existing order detail page file
function ShippingActionPanel({ order }: { order: { id: string; shipping_provider?: string; shipping_status?: string } }) {
  const [loading, setLoading] = useState(false);
  const [manualNote, setManualNote] = useState('');
  const [result, setResult] = useState<string | null>(null);

  async function handleShip(provider: 'shiprocket' | 'icarry' | 'manual') {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, manualNote }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`✅ Shipped via ${provider}${data.awb ? ` — AWB: ${data.awb}` : ''}`);
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch {
      setResult('❌ Request failed. Try again.');
    }
    setLoading(false);
  }

  // Only show panel if order hasn't been shipped yet
  if (order.shipping_provider && order.shipping_provider !== 'pending') {
    return (
      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-600">Shipped via
          <span className="ml-1 font-bold capitalize text-gray-900">{order.shipping_provider}</span>
        </p>
        <p className="text-sm text-gray-500">Status: {order.shipping_status}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        Select Shipping Method
      </h3>

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Shiprocket */}
        <button
          onClick={() => handleShip('shiprocket')}
          disabled={loading}
          className="flex-1 rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
        >
          🚀 Ship via Shiprocket
        </button>

        {/* iCarry */}
        <button
          onClick={() => handleShip('icarry')}
          disabled={loading}
          className="flex-1 rounded-lg border border-purple-300 bg-white px-4 py-3 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50 transition-colors"
        >
          📦 Ship via iCarry
        </button>

        {/* Manual */}
        <button
          onClick={() => handleShip('manual')}
          disabled={loading}
          className="flex-1 rounded-lg border border-green-300 bg-white px-4 py-3 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
        >
          🏍️ Manual Delivery
        </button>
      </div>

      {/* Manual delivery note — shown when manual is chosen */}
      <div className="mt-3">
        <textarea
          className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-amber-400 focus:outline-none"
          rows={2}
          placeholder="Optional: Add a manual delivery note (e.g. dispatched via local courier, call 9XXXXXXXXX)"
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
        />
      </div>

      {loading && (
        <p className="mt-3 text-sm text-gray-500">Processing shipment...</p>
      )}

      {result && (
        <p className="mt-3 text-sm font-medium">{result}</p>
      )}
    </div>
  );
}
```

Then in the page JSX, below the existing order detail content, add:
```tsx
<ShippingActionPanel order={order} />
```

---

## SECTION 6 — COUPON CODE SYSTEM

### What to build
- Supabase table for coupons
- API routes for CRUD
- Admin panel page for managing coupons
- Checkout: coupon input with confetti burst on success
- Thin marquee banner on homepage showing active coupons
- Apply discount in order total calculation

---

### Step 1 — Create coupons table in Supabase

```sql
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('flat', 'percentage', 'flat_on_minimum', 'percentage_on_minimum')),
  value NUMERIC NOT NULL,
  minimum_order_amount NUMERIC DEFAULT 0,
  maximum_discount NUMERIC,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  per_user_limit INTEGER,
  expires_at TIMESTAMPTZ,
  applicable_categories TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast code lookups at checkout
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_is_active ON coupons(is_active);

-- Auto-update updated_at
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  -- (this trigger function was created in Section 1 — if you run sections out of order,
  --  create the function first from the products section)

-- Track per-order coupon usage (reference from orders table)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0;
```

---

### Step 2 — Admin coupon API routes

Create file: `app/api/admin/coupons/route.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — list all coupons (admin only)
export async function GET() {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create new coupon (admin only)
export async function POST(req: Request) {
  const body = await req.json();

  // Force code to be uppercase and trimmed
  body.code = body.code?.toUpperCase().trim();

  // Validate required fields
  if (!body.code || !body.type || body.value === undefined) {
    return NextResponse.json({ error: 'code, type, and value are required' }, { status: 400 });
  }

  const { data, error } = await supabase.from('coupons').insert(body).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

Create file: `app/api/admin/coupons/[id]/route.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PUT — update a coupon
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (body.code) body.code = body.code.toUpperCase().trim();

  const { data, error } = await supabase
    .from('coupons')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — remove a coupon
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await supabase.from('coupons').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH — toggle active/inactive
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { is_active } = await req.json();
  const { data, error } = await supabase
    .from('coupons')
    .update({ is_active })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

---

### Step 3 — Public coupon routes

Create file: `app/api/coupons/active/route.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // public key — ok for this read
);

export async function GET() {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('coupons')
    .select('code, type, value, minimum_order_amount, description')
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json([], { status: 200 });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}
```

Create file: `app/api/coupons/apply/route.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { code, orderAmount, userId } = await req.json();

  if (!code || !orderAmount) {
    return NextResponse.json({ error: 'code and orderAmount are required' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !coupon) {
    return NextResponse.json({ error: 'Invalid or inactive coupon code' }, { status: 404 });
  }

  if (coupon.expires_at && new Date() > new Date(coupon.expires_at)) {
    return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 });
  }

  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return NextResponse.json({ error: 'This coupon has reached its usage limit' }, { status: 400 });
  }

  if (
    coupon.minimum_order_amount > 0 &&
    orderAmount < coupon.minimum_order_amount
  ) {
    return NextResponse.json({
      error: `Minimum order of ₹${coupon.minimum_order_amount} required for this coupon`,
    }, { status: 400 });
  }

  // Per-user limit check
  if (userId && coupon.per_user_limit) {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('coupon_code', coupon.code);

    if ((count || 0) >= coupon.per_user_limit) {
      return NextResponse.json({
        error: 'You have already used this coupon the maximum number of times',
      }, { status: 400 });
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.type === 'flat' || coupon.type === 'flat_on_minimum') {
    discount = coupon.value;
  } else if (coupon.type === 'percentage' || coupon.type === 'percentage_on_minimum') {
    discount = (orderAmount * coupon.value) / 100;
    if (coupon.maximum_discount) {
      discount = Math.min(discount, coupon.maximum_discount);
    }
  }

  discount = Math.min(Math.round(discount), orderAmount);

  return NextResponse.json({
    valid: true,
    discount,
    couponId: coupon.id,
    message: `Coupon applied! You save ₹${discount}`,
  });
}
```

---

### Step 4 — Checkout: coupon input component

Create file: `components/checkout/CouponInput.tsx`

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface CouponInputProps {
  orderAmount: number;
  userId?: string;
  onApplied: (coupon: { code: string; discount: number; couponId: string } | null) => void;
}

export function CouponInput({ orderAmount, userId, onApplied }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string; discount: number; couponId: string;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (confettiRef.current) clearTimeout(confettiRef.current); };
  }, []);

  async function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, orderAmount, userId }),
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        const applied = { code: trimmed, discount: data.discount, couponId: data.couponId };
        setAppliedCoupon(applied);
        setStatus('success');
        setMessage(data.message);
        onApplied(applied);
        setShowConfetti(true);
        confettiRef.current = setTimeout(() => setShowConfetti(false), 3500);
      } else {
        setStatus('error');
        setMessage(data.error || 'Invalid coupon');
      }
    } catch {
      setStatus('error');
      setMessage('Could not apply coupon. Please try again.');
    }
  }

  function handleRemove() {
    setAppliedCoupon(null);
    setStatus('idle');
    setMessage('');
    setCode('');
    onApplied(null);
  }

  return (
    <div className="relative mt-4">
      {/* Confetti overlay */}
      {showConfetti && <Confetti />}

      <p className="mb-2 text-sm font-medium text-gray-700">Have a coupon code?</p>

      {status !== 'success' ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            placeholder="Enter coupon code"
            disabled={status === 'loading'}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase tracking-wider focus:border-amber-400 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleApply}
            disabled={status === 'loading' || !code.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {status === 'loading' ? 'Applying...' : 'Apply'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-base">🏷️</span>
            <div>
              <p className="text-sm font-semibold text-green-800">{appliedCoupon?.code}</p>
              <p className="text-xs text-green-600">−₹{appliedCoupon?.discount} saved</p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="text-xs font-medium text-red-500 hover:text-red-700 underline"
          >
            Remove
          </button>
        </div>
      )}

      {/* Error message */}
      {status === 'error' && message && (
        <p className="mt-2 text-xs font-medium text-red-600">{message}</p>
      )}

      {/* Success message (shown briefly then hidden) */}
      {status === 'success' && message && (
        <p className="mt-2 text-xs font-medium text-green-600">{message}</p>
      )}
    </div>
  );
}

// Lightweight CSS confetti — no external library needed
function Confetti() {
  const colors = ['#ffd700', '#ff6b6b', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8'];
  const pieces = Array.from({ length: 40 }, (_, i) => i);

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: fixed;
          top: 0;
          pointer-events: none;
          z-index: 9999;
          animation: confettiFall linear forwards;
        }
      `}</style>
      {pieces.map((i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}vw`,
            width: `${6 + Math.random() * 8}px`,
            height: `${6 + Math.random() * 8}px`,
            background: colors[i % colors.length],
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${Math.random() * 0.4}s`,
            animationDuration: `${1 + Math.random() * 1.5}s`,
          }}
        />
      ))}
    </>
  );
}
```

Use in your checkout page wherever the order summary section is:
```tsx
import { CouponInput } from '@/components/checkout/CouponInput';

// In checkout page state:
const [appliedCoupon, setAppliedCoupon] = useState<{
  code: string; discount: number; couponId: string;
} | null>(null);

const finalAmount = subtotal - (appliedCoupon?.discount || 0) + shippingFee;

// In JSX, inside the order summary section:
<CouponInput
  orderAmount={subtotal}
  userId={user?.id}
  onApplied={setAppliedCoupon}
/>

// Order total display:
<div className="space-y-1 border-t pt-3 text-sm">
  <div className="flex justify-between text-gray-600">
    <span>Subtotal</span><span>₹{subtotal}</span>
  </div>
  {appliedCoupon && (
    <div className="flex justify-between font-medium text-green-600">
      <span>Coupon ({appliedCoupon.code})</span>
      <span>−₹{appliedCoupon.discount}</span>
    </div>
  )}
  <div className="flex justify-between text-gray-600">
    <span>Shipping</span>
    <span>{shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}</span>
  </div>
  <div className="flex justify-between border-t pt-2 text-base font-bold">
    <span>Total</span><span>₹{finalAmount}</span>
  </div>
</div>
```

When creating the order, pass coupon info to the API:
```ts
// In checkout form submit / order creation:
body: JSON.stringify({
  ...orderData,
  coupon_id: appliedCoupon?.couponId || null,
  coupon_code: appliedCoupon?.code || null,
  coupon_discount: appliedCoupon?.discount || 0,
  total_amount: finalAmount,
})
```

In the order creation API, after saving the order, increment coupon usage:
```ts
if (body.coupon_id) {
  await supabase.rpc('increment_coupon_usage', { coupon_id: body.coupon_id });
  // Create this RPC in Supabase SQL Editor:
  // CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_id UUID)
  // RETURNS void AS $$
  //   UPDATE coupons SET usage_count = usage_count + 1 WHERE id = coupon_id;
  // $$ LANGUAGE sql;
}
```

---

### Step 5 — Homepage coupon marquee banner

Create file: `components/CouponMarquee.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Coupon {
  code: string;
  type: string;
  value: number;
  minimum_order_amount: number;
}

function couponLabel(c: Coupon): string {
  if (c.type === 'flat') return `Use ${c.code} — ₹${c.value} OFF`;
  if (c.type === 'percentage') return `Use ${c.code} — ${c.value}% OFF`;
  if (c.type === 'flat_on_minimum')
    return `Use ${c.code} — ₹${c.value} OFF on orders above ₹${c.minimum_order_amount}`;
  if (c.type === 'percentage_on_minimum')
    return `Use ${c.code} — ${c.value}% OFF on orders above ₹${c.minimum_order_amount}`;
  return `Code: ${c.code}`;
}

export function CouponMarquee() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    async function fetchCoupons() {
      try {
        const res = await fetch('/api/coupons/active');
        const data = await res.json();
        setCoupons(data || []);
      } catch {
        // silently fail — marquee is non-critical
      }
    }

    fetchCoupons();
    const interval = setInterval(fetchCoupons, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (coupons.length === 0) return null;

  // Duplicate labels for seamless infinite loop
  const labels = [...coupons, ...coupons].map(couponLabel);

  return (
    <div className="overflow-hidden bg-gray-900 py-1.5">
      <div
        className="flex whitespace-nowrap"
        style={{ animation: 'marqueeScroll 35s linear infinite' }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.animationPlayState = 'paused')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.animationPlayState = 'running')
        }
      >
        {labels.map((label, i) => (
          <span
            key={i}
            className="px-10 text-xs font-medium tracking-wide text-amber-400"
          >
            🏷️ {label}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes marqueeScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
```

In your homepage layout file (e.g. `app/page.tsx` or `components/layout/HomeLayout.tsx`),
place `<CouponMarquee />` immediately after `<HeroCarousel />` (or whatever your hero 
carousel component is called). Do not place it anywhere else.

---

### Step 6 — Admin coupon management page

Create file: `app/admin/coupons/page.tsx`

This page has:
1. A table showing all coupons with columns: Code | Type | Value | Min Order | Status | Expiry | Uses | Actions
2. A toggle switch in the Status column to activate/deactivate
3. Edit and Delete buttons per row
4. A "Create New Coupon" button that opens a form panel

```tsx
'use client';

import { useEffect, useState } from 'react';

type CouponType = 'flat' | 'percentage' | 'flat_on_minimum' | 'percentage_on_minimum';

interface Coupon {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minimum_order_amount: number;
  maximum_discount?: number;
  is_active: boolean;
  usage_limit?: number;
  usage_count: number;
  per_user_limit?: number;
  expires_at?: string;
}

const TYPE_LABELS: Record<CouponType, string> = {
  flat: 'Flat ₹ Off',
  percentage: '% Off',
  flat_on_minimum: 'Flat ₹ Off (Min Order)',
  percentage_on_minimum: '% Off (Min Order)',
};

const EMPTY_FORM: Omit<Coupon, 'id' | 'usage_count'> = {
  code: '',
  description: '',
  type: 'flat',
  value: 0,
  minimum_order_amount: 0,
  maximum_discount: undefined,
  is_active: true,
  usage_limit: undefined,
  per_user_limit: undefined,
  expires_at: undefined,
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCoupons(); }, []);

  async function fetchCoupons() {
    const res = await fetch('/api/admin/coupons');
    const data = await res.json();
    setCoupons(data || []);
  }

  async function handleSave() {
    setSaving(true);
    const payload = { ...form, code: form.code.toUpperCase().trim() };
    const url = editingId
      ? `/api/admin/coupons/${editingId}`
      : '/api/admin/coupons';
    const method = editingId ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    fetchCoupons();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this coupon? This cannot be undone.')) return;
    await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
    fetchCoupons();
  }

  async function handleToggle(coupon: Coupon) {
    await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !coupon.is_active }),
    });
    fetchCoupons();
  }

  function handleEdit(coupon: Coupon) {
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      type: coupon.type,
      value: coupon.value,
      minimum_order_amount: coupon.minimum_order_amount,
      maximum_discount: coupon.maximum_discount,
      is_active: coupon.is_active,
      usage_limit: coupon.usage_limit,
      per_user_limit: coupon.per_user_limit,
      expires_at: coupon.expires_at,
    });
    setEditingId(coupon.id);
    setShowForm(true);
  }

  const isMinimumType = form.type === 'flat_on_minimum' || form.type === 'percentage_on_minimum';
  const isPercentageType = form.type === 'percentage' || form.type === 'percentage_on_minimum';

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Coupon Codes</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Create New Coupon
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-4 text-base font-semibold">
            {editingId ? 'Edit Coupon' : 'New Coupon'}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Coupon Code *
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SAVE10"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase tracking-wider"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description (admin label)
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Welcome discount"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Coupon Type *
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isPercentageType ? 'Discount Percentage (%)' : 'Discount Amount (₹)'} *
              </label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                min={0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {isMinimumType && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Minimum Order Amount (₹)
                </label>
                <input
                  type="number"
                  value={form.minimum_order_amount}
                  onChange={(e) => setForm({ ...form, minimum_order_amount: Number(e.target.value) })}
                  min={0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            {isPercentageType && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Maximum Discount Cap (₹) — leave blank for no cap
                </label>
                <input
                  type="number"
                  value={form.maximum_discount ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, maximum_discount: e.target.value ? Number(e.target.value) : undefined })
                  }
                  min={0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Total Usage Limit — leave blank for unlimited
              </label>
              <input
                type="number"
                value={form.usage_limit ?? ''}
                onChange={(e) =>
                  setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : undefined })
                }
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Per User Limit — leave blank for unlimited
              </label>
              <input
                type="number"
                value={form.per_user_limit ?? ''}
                onChange={(e) =>
                  setForm({ ...form, per_user_limit: e.target.value ? Number(e.target.value) : undefined })
                }
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Expiry Date — leave blank for no expiry
              </label>
              <input
                type="datetime-local"
                value={form.expires_at ? form.expires_at.substring(0, 16) : ''}
                onChange={(e) =>
                  setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-3 pt-4">
              <label className="text-xs font-medium text-gray-600">Active?</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.is_active ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Coupons table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              {['Code', 'Type', 'Value', 'Min Order', 'Status', 'Expiry', 'Uses', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {coupons.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No coupons yet</td></tr>
            )}
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-gray-900">{coupon.code}</td>
                <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[coupon.type]}</td>
                <td className="px-4 py-3">
                  {coupon.type.includes('percentage') ? `${coupon.value}%` : `₹${coupon.value}`}
                  {coupon.maximum_discount ? ` (max ₹${coupon.maximum_discount})` : ''}
                </td>
                <td className="px-4 py-3">
                  {coupon.minimum_order_amount > 0 ? `₹${coupon.minimum_order_amount}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(coupon)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      coupon.is_active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    title={coupon.is_active ? 'Click to deactivate' : 'Click to activate'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        coupon.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {coupon.expires_at
                    ? new Date(coupon.expires_at).toLocaleDateString('en-IN')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {coupon.usage_count}
                  {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(coupon.id)}
                      className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Add this page to your existing admin sidebar navigation under the existing admin nav links.

---

## SECTION 7 — SOCIAL MEDIA URLS

Find all occurrences of any Instagram and Facebook URLs in the project.

Run in terminal:
```bash
grep -r "instagram.com" . --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" --include="*.json"
grep -r "facebook.com" . --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" --include="*.json"
```

Replace every Instagram URL found with exactly:
```
https://www.instagram.com/reveilfragrance/
```

Replace every Facebook URL found with exactly:
```
https://www.facebook.com/reveilfragrances
```

Also update these in the Organization schema in `lib/google-sync.ts` (Section 3).

---

## SECTION 8 — ALL ENVIRONMENT VARIABLES

Add these to `.env.local` (local) and your Vercel/production environment:


# Google
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}  ← full JSON, single line
GOOGLE_MERCHANT_ID=123456789  ← numeric ID only, no spaces

# iCarry
ICARRY_USERNAME=ela25039
ICARRY_API_KEY=[REDACTED — set ICARRY_API_KEY in .env.local / Vercel env. ROTATE this key with iCarry: it was previously committed to git history.]
ICARRY_PICKUP_ADDRESS_ID=your_pickup_id  ← get from iCarry dashboard

# Resend (should already exist)
RESEND_API_KEY=re_your_existing_key
```

---


🔴 Google
service account json

{
  "type": "service_account",
  "project_id": "reveil-fragrances",
  "private_key_id": "[REDACTED — set via GOOGLE_SERVICE_ACCOUNT_JSON in .env.local]",
  "private_key": "[REDACTED — full key lives only in .env.local / Vercel env. ROTATE this key in Google Cloud: it was previously committed to git history.]",
  "client_email": "reveil@reveil-fragrances.iam.gserviceaccount.com",
  "client_id": "109949298866234037792",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/reveil%40reveil-fragrances.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}

reveil
Merchant Center ID
5799780081

🟠 iCarry 
ICARRY_PICKUP_ADDRESS_ID
Trimurty Enterprises (Refreshub)
trimurthyent@gmail.com
7008879914 | 9937201095
Marthapeta Street
Near Sidheswar Kalyan Mandap
Berhampur 760009
Odisha
India		

Address Id: 52875


## SECTION 9 — IMPLEMENTATION ORDER

Execute in exactly this sequence. Do not skip steps or reorder:

1. Run all Supabase SQL migrations (Sections 1, 2, 6)
2. Delete `public/sitemap.xml` static file
3. Create `app/sitemap.xml/route.ts`
4. Add slug + SKU auto-generation to admin product save handler
5. Create `components/ProductSchema.tsx` and add to product page
6. Create `lib/google-sync.ts` (install `googleapis` first)
7. Hook `upsertMerchantProduct` + `notifyGoogleIndexing` into existing product API routes
8. Create `emails/AdminOrderNotification.tsx` and `lib/notify-admin-order.ts`
9. Call `sendAdminOrderNotification` in the order creation API
10. Add `shipping_provider` columns to orders table (already in SQL above)
11. Create `lib/shipping/icarry.ts`
12. Create all three iCarry webhook handlers
13. Create `app/api/admin/orders/[id]/ship/route.ts`
14. Add `ShippingActionPanel` to admin order detail page
15. Create all coupon API routes
16. Create `components/checkout/CouponInput.tsx`
17. Add CouponInput to checkout page + update order creation to save coupon
18. Create `components/CouponMarquee.tsx` and add to homepage after hero carousel
19. Create `app/admin/coupons/page.tsx` and add to admin nav
20. Do the social media URL find-and-replace
21. Deploy and test sitemap at `https://www.reveilfragrance.in/sitemap.xml`
22. In Google Search Console → Sitemaps → Submit `https://www.reveilfragrance.in/sitemap.xml`
23. In Google Search Console → URL Inspection → test any product URL and request indexing
