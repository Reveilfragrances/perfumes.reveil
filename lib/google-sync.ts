/**
 * GOOGLE MERCHANT CENTER (Content API for Shopping v2.1) SYNC
 *
 * Pushes product create/update/delete to Google Merchant Center so products
 * appear in Google Shopping without manual feed uploads. Uses a service-account
 * access token minted in lib/google/auth (no external SDK).
 *
 * Configure in the environment:
 *   GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY)
 *   GOOGLE_MERCHANT_ID  — the numeric Merchant Center account id
 *
 * Every function is best-effort: it logs and returns on error and NEVER throws,
 * so product CRUD in the admin is never blocked by a Merchant sync failure.
 * When credentials / merchant id are missing it no-ops silently.
 */

import { getGoogleAccessToken } from '@/lib/google/auth'
import { SITE_URL, BRAND_NAME } from '@/lib/seo/keywords'

const CONTENT_SCOPE = 'https://www.googleapis.com/auth/content'
const CONTENT_BASE = 'https://shoppingcontent.googleapis.com/content/v2.1'

type SyncProduct = {
    id: string
    name: string
    slug: string
    description?: string | null
    sku?: string | null
    price: number
    stock: number
    images?: string[] | null
    category?: string | null
    // Unit pricing — required by Google Merchant Center for liquid/weighted products in India
    unit?: string | null                    // e.g. 'ml', 'g'
    unit_pricing_base_measure?: string | null // e.g. '100ml'
    shipping_weight?: number | null          // in kg, e.g. 0.2
}

function skuFor(product: { id: string; sku?: string | null }): string {
    if (product.sku) return String(product.sku).substring(0, 40)
    return `REVEIL-${product.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`
}

function merchantOfferId(product: { id: string; sku?: string | null }): string {
    return skuFor(product)
}

function buildMerchantPayload(product: SyncProduct) {
    const offerId = merchantOfferId(product)
    const unitCode = product.unit || 'ml'
    const baseMeasureRaw = parseFloat(product.unit_pricing_base_measure || '') || 100

    return {
        offerId,
        title: product.name,
        description: (product.description || product.name).substring(0, 5000),
        link: `${SITE_URL}/products/${product.slug}`,
        imageLink: product.images?.[0] || `${SITE_URL}/logo.png`,
        additionalImageLinks: (product.images || []).slice(1, 10),
        contentLanguage: 'en',
        targetCountry: 'IN',
        channel: 'online',
        availability: product.stock > 0 ? 'in stock' : 'out of stock',
        condition: 'new',
        price: { value: product.price.toFixed(2), currency: 'INR' },
        brand: BRAND_NAME,
        mpn: offerId,
        googleProductCategory: '2915', // Health & Beauty > Fragrances

        // unit_pricing_measure — fixes "Missing unit pricing measure" in Merchant Center
        // Required for liquid/weighted products in India
        unitPricingMeasure: { value: baseMeasureRaw, unit: unitCode },
        unitPricingBaseMeasure: { value: 100, unit: unitCode },

        // shipping — fixes "Missing shipping costs"
        shipping: [
            {
                country: 'IN',
                service: 'Standard Free Shipping',
                price: { value: '0.00', currency: 'INR' },
            },
        ],

        // shipping_weight
        ...(product.shipping_weight
            ? { shippingWeight: { value: product.shipping_weight, unit: 'kg' } }
            : {}),
    }
}

function getMerchantId(): string | null {
    const id = process.env.GOOGLE_MERCHANT_ID
    return id ? String(id).trim() : null
}

export async function upsertMerchantProduct(product: SyncProduct) {
    const merchantId = getMerchantId()
    if (!merchantId) return
    const token = await getGoogleAccessToken([CONTENT_SCOPE])
    if (!token) return

    try {
        const res = await fetch(`${CONTENT_BASE}/${merchantId}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(buildMerchantPayload(product)),
        })
        if (!res.ok) {
            const body = await res.text().catch(() => '')
            console.error('[Merchant Center upsert]', res.status, body)
        }
    } catch (err: unknown) {
        console.error('[Merchant Center upsert]', (err as Error).message)
    }
}

export async function deleteMerchantProduct(product: { id: string; sku?: string | null }) {
    const merchantId = getMerchantId()
    if (!merchantId) return
    const token = await getGoogleAccessToken([CONTENT_SCOPE])
    if (!token) return

    try {
        const productId = `online:en:IN:${skuFor(product)}`
        const res = await fetch(`${CONTENT_BASE}/${merchantId}/products/${encodeURIComponent(productId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok && res.status !== 404) {
            const body = await res.text().catch(() => '')
            console.error('[Merchant Center delete]', res.status, body)
        }
    } catch (err: unknown) {
        console.error('[Merchant Center delete]', (err as Error).message)
    }
}

// ── Bulk sync ALL active products ────────────────────────────────────────────
// Run once after deploy (via POST /api/admin/sync-merchant) to push the full
// catalogue to Merchant Center without manual feed uploads.

export async function bulkSyncAllProducts() {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, description, sku, price, stock, images, category, unit, unit_pricing_base_measure, shipping_weight')
        .eq('is_active', true)

    if (error) {
        console.error('[Merchant Center bulk sync] Supabase error:', error.message)
        return
    }
    if (!products || products.length === 0) {
        console.log('[Merchant Center bulk sync] No active products found.')
        return
    }

    console.log(`[Merchant Center bulk sync] Starting sync of ${products.length} products...`)

    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < products.length; i += 5) {
        const batch = products.slice(i, i + 5)
        await Promise.all(batch.map((p) => upsertMerchantProduct(p)))
        if (i + 5 < products.length) {
            await new Promise((r) => setTimeout(r, 1000)) // 1s delay between batches
        }
    }

    console.log('[Merchant Center bulk sync] Complete.')
}
