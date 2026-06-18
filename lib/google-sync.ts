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
    price: number
    stock: number
    images?: string[] | null
    category?: string | null
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
        price: { value: String(product.price), currency: 'INR' },
        brand: BRAND_NAME,
        mpn: offerId,
        googleProductCategory: '2915', // "Health & Beauty > Personal Care > Cosmetics > Bath & Body > Fragrances"
        shipping: [
            { country: 'IN', service: 'Standard', price: { value: '0', currency: 'INR' } },
        ],
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
